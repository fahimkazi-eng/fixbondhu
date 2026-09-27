import { Prisma } from "@fixbondhu/db";
import { latinSkeleton, parseQuery, type ParsedQuery } from "@fixbondhu/core";

import { prisma } from "./db";

/**
 * Search.
 *
 * The ranking contract with customers: someone typing "fan thik korte hobe"
 * must reach Fan Repair, and someone typing "plumber দরকার" must reach a plumber
 * near them. That is only achievable because matching runs in two layers
 * (see searchSkeleton in the schema and the note in packages/core/src/search.ts).
 *
 * Sponsored placement is applied LAST and only as a tie-breaker among results
 * that already qualify. It can never promote a provider who does not cover the
 * area, is unavailable, or does not offer the service, and it is rendered with
 * a distinct label that cannot be mistaken for a verification badge.
 */

export interface ServiceSearchOptions {
  query: string;
  locationId?: string | null;
  /** Filters to services a specific provider offers. */
  providerProfileId?: string | null;
  limit?: number;
  offset?: number;
}

export interface ServiceSearchHit {
  serviceId: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  categorySlug: string;
  categoryNameEn: string;
  icon: string | null;
  isEmergency: boolean;
  /** Distinct provider count actually able to take this job. */
  availableProviders: number;
  minPricePoisha: number | null;
  maxPricePoisha: number | null;
  score: number;
  /** How the row matched, for debugging relevance. */
  matchedOn: "skeleton" | "text" | "none";
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Trigram threshold, applied with WORD similarity, not plain similarity.
 *
 * This distinction is the whole ballgame. `similarity(a, b)` compares two
 * strings of comparable length, so scoring a long keyword document against a
 * two-word query always lands below any useful threshold. `word_similarity(a, b)`
 * asks the right question: "does b contain a word like a?" and is exposed by
 * pg_trgm as the `<%` operator. Using `similarity` here returned zero results
 * for every query, which is exactly what the first live run showed.
 */
const SIMILARITY_THRESHOLD = 0.25;

type MatchMode = "ALL" | "ANY";

async function runServiceSearch(
  options: ServiceSearchOptions,
  parsed: ParsedQuery,
  tokens: string[],
  skeletons: string[],
  mode: MatchMode,
  limit: number,
  offset: number,
): Promise<ServiceSearchHit[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      nameEn: string;
      nameBn: string;
      icon: string | null;
      isEmergency: boolean;
      categorySlug: string;
      categoryNameEn: string;
      score: number | null;
      textScore: number | null;
      skeletonScore: number | null;
      matchedTokens: bigint;
      providerCount: bigint;
      minPrice: number | null;
      maxPrice: number | null;
    }>
  >(Prisma.sql`
    WITH q AS (
      SELECT * FROM unnest(
        ARRAY[${Prisma.join(tokens)}]::text[],
        ARRAY[${Prisma.join(skeletons)}]::text[]
      ) AS t(tok, skel)
    ),
    matched AS (
      SELECT
        s.id,
        COUNT(*)::bigint AS "matchedTokens",
        MAX(word_similarity(q.tok, s."searchText")) AS "textScore",
        MAX(word_similarity(q.skel, s."searchSkeleton")) AS "skeletonScore"
      FROM services s
      CROSS JOIN q
      WHERE s."isActive" = true
        AND s."isPublished" = true
        AND (
          s."searchText" ILIKE '%' || q.tok || '%'
          OR q.tok <% s."searchText"
          OR s."searchSkeleton" ILIKE '%' || q.skel || '%'
          OR q.skel <% s."searchSkeleton"
        )
      GROUP BY s.id
    )
    SELECT
      s.id,
      s.slug,
      s."nameEn",
      s."nameBn",
      s.icon,
      s."isEmergency",
      c.slug    AS "categorySlug",
      c."nameEn" AS "categoryNameEn",
      GREATEST(COALESCE(m."textScore", 0), COALESCE(m."skeletonScore", 0))::float AS score,
      m."textScore"::float AS "textScore",
      m."skeletonScore"::float AS "skeletonScore",
      m."matchedTokens"::bigint AS "matchedTokens",
      COUNT(DISTINCT ps."providerProfileId")::bigint AS "providerCount",
      MIN(ps."minPricePoisha")::int AS "minPrice",
      MAX(ps."maxPricePoisha")::int AS "maxPrice"
    FROM matched m
    JOIN services s ON s.id = m.id
    JOIN categories c ON c.id = s."categoryId"
    LEFT JOIN provider_services ps
      ON ps."serviceId" = s.id AND ps."isActive" = true
    LEFT JOIN provider_profiles pp
      ON pp.id = ps."providerProfileId"
      AND pp.status = 'ACTIVE'
      AND pp."deletedAt" IS NULL
    WHERE (${mode} = 'ALL' AND m."matchedTokens" = ${tokens.length}::bigint)
       OR (${mode} = 'ANY' AND m."matchedTokens" > 0)
      ${options.providerProfileId
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM provider_services p2
            WHERE p2."serviceId" = s.id
              AND p2."isActive" = true
              AND p2."providerProfileId" = ${options.providerProfileId}::text
          )`
        : Prisma.empty}
    GROUP BY s.id, c.slug, c."nameEn", m."textScore", m."skeletonScore", m."matchedTokens"
    ORDER BY m."matchedTokens" DESC, score DESC, s."nameEn" ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows.map((row) => ({
    serviceId: row.id,
    slug: row.slug,
    nameEn: row.nameEn,
    nameBn: row.nameBn,
    categorySlug: row.categorySlug,
    categoryNameEn: row.categoryNameEn,
    icon: row.icon,
    isEmergency: row.isEmergency,
    availableProviders: Number(row.providerCount),
    minPricePoisha: row.minPrice,
    maxPricePoisha: row.maxPrice,
    score: row.score ?? 0,
    matchedOn: (row.skeletonScore ?? 0) >= (row.textScore ?? 0) ? "skeleton" : "text",
  }));
}

export async function searchServices(
  options: ServiceSearchOptions,
): Promise<{ parsed: ParsedQuery; hits: ServiceSearchHit[]; total: number }> {
  const parsed = parseQuery(options.query);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);

  if (parsed.tokens.length === 0) {
    return { parsed, hits: [], total: 0 };
  }

  const tokens = parsed.tokens;
  const skeletons = tokens.map((token) => {
    const skeleton = latinSkeleton(token);
    // Under three characters there are no trigrams to compare, so the literal
    // token is the only thing worth matching on.
    return skeleton.length >= 3 ? skeleton : token;
  });

  // Precision first: every core token must be found.
  const strict = await runServiceSearch(
    options, parsed, tokens, skeletons, "ALL", limit, offset,
  );
  if (strict.length > 0) {
    return { parsed, hits: strict, total: strict.length };
  }

  /*
   * Recall second.
   *
   * A multi-word query where one word is a heavy misspelling, or carries no
   * service identity at all, kills an AND search: "tala khola lagbe" ("open
   * the lock") must still reach the locksmith, and "woda pump" must still reach
   * the pump service even though "woda" is unmatchable by trigram. An empty
   * result page is the worst possible outcome for a customer in need, so any
   * token match is better than nothing. Rows are ordered by how many tokens
   * matched, so the service that matches the service-bearing word still wins.
   */
  const relaxed = await runServiceSearch(
    options, parsed, tokens, skeletons, "ANY", limit, offset,
  );
  return { parsed, hits: relaxed, total: relaxed.length };
}

export interface ProviderSearchOptions {
  serviceId?: string | null;
  locationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  query?: string | null;
  limit?: number;
  offset?: number;
  /** Exclude these provider ids, e.g. providers the customer already asked. */
  excludeProviderIds?: string[];
}

export interface ProviderHit {
  id: string;
  slug: string;
  displayName: string;
  photoUrl: string | null;
  headline: string | null;
  experienceYears: number;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  responseRate: number;
  /** Straight-line km from the customer, or null when unknown. */
  distanceKm: number | null;
  minPricePoisha: number | null;
  /** True when the provider declared a service area covering the customer. */
  coversLocation: boolean;
  isSponsored: boolean;
  verifiedTypes: string[];
  openSlotCount: number;
  score: number;
}

/**
 * Provider matching.
 *
 * Ordered by what actually determines whether a job gets done, not by who paid
 * most: service fit and service area first, then availability, then distance,
 * then reputation. Sponsorship only breaks ties between providers that are
 * otherwise equivalent, which keeps paid placement from degrading the results
 * customers rely on to get help.
 */
export async function searchProviders(
  options: ProviderSearchOptions,
): Promise<{ hits: ProviderHit[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 50);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      "displayName": string;
      "photoUrl": string | null;
      headline: string | null;
      "experienceYears": number;
      "ratingAvg": number;
      "ratingCount": number;
      "completedJobs": number;
      "responseRate": number;
      distance: number | null;
      "minPrice": number | null;
      "coversLocation": boolean;
      "isSponsored": boolean;
      "verifiedTypes": string[];
      "openSlots": bigint;
      score: number;
    }>
  >(Prisma.sql`
    SELECT
      pp.id,
      pp.slug,
      pp."displayName",
      pp."photoUrl",
      pp.headline,
      pp."experienceYears",
      pp."ratingAvg",
      pp."ratingCount",
      pp."completedJobs",
      pp."responseRate",
      ${options.latitude != null && options.longitude != null
        ? Prisma.sql`(6371 * 2 * asin(sqrt(
            power(sin(radians(pp.latitude - ${options.latitude}) / 2), 2)
            + cos(radians(${options.latitude})) * cos(radians(pp.latitude))
            * power(sin(radians(pp.longitude - ${options.longitude}) / 2), 2)
          )))`
        : Prisma.sql`NULL::double precision`} AS distance,
      MIN(ps."minPricePoisha")::int AS "minPrice",
      ${options.locationId
        ? Prisma.sql`EXISTS (
            SELECT 1 FROM provider_service_areas psa
            WHERE psa."providerProfileId" = pp.id
              AND psa."locationId" = ${options.locationId}::text
              AND psa."isActive" = true
          )`
        : Prisma.sql`false`} AS "coversLocation",
      pp."isSponsored",
      COALESCE((
        SELECT array_agg(DISTINCT pv.type::text)
        FROM provider_verifications pv
        WHERE pv."providerProfileId" = pp.id
          AND pv.status = 'APPROVED'
      ), ARRAY[]::text[]) AS "verifiedTypes",
      COALESCE((
        SELECT COUNT(*) FROM provider_availability pa
        WHERE pa."providerProfileId" = pp.id AND pa."isActive" = true
      ), 0)::bigint AS "openSlots",
      (
        -- Service fit, which dominates everything else.
        (CASE WHEN ${options.serviceId ? Prisma.sql`EXISTS (
            SELECT 1 FROM provider_services ps3
            WHERE ps3."providerProfileId" = pp.id
              AND ps3."serviceId" = ${options.serviceId}::text
              AND ps3."isActive" = true
        )` : Prisma.sql`false`} THEN 40 ELSE 0 END)
        -- Declared coverage of the customer's locality.
        + (CASE WHEN ${options.locationId ? Prisma.sql`EXISTS (
            SELECT 1 FROM provider_service_areas psa2
            WHERE psa2."providerProfileId" = pp.id
              AND psa2."locationId" = ${options.locationId}::text
              AND psa2."isActive" = true
        )` : Prisma.sql`false`} THEN 25 ELSE 0 END)
        -- Reputation, from real completed work only.
        + LEAST(pp."ratingAvg", 5) * 4
        + LEAST(pp."responseRate", 1) * 10
        + LEAST(pp."completedJobs"::double precision / 50, 1) * 8
        + MIN(pa2."capacity", 10) * 0.5
        -- Tie-breaker only: paid placement cannot outweigh the above.
        + (CASE WHEN pp."isSponsored" THEN 1.5 ELSE 0 END)
        - (CASE WHEN ${options.latitude != null && options.longitude != null
            ? Prisma.sql`EXISTS (
                SELECT 1 FROM provider_service_areas psa3
                WHERE psa3."providerProfileId" = pp.id AND psa3."isActive" = true
              ) AND (6371 * 2 * asin(sqrt(
                  power(sin(radians(pp.latitude - ${options.latitude}) / 2), 2)
                  + cos(radians(${options.latitude})) * cos(radians(pp.latitude))
                  * power(sin(radians(pp.longitude - ${options.longitude}) / 2), 2)
                ))) > COALESCE((
                    SELECT MIN(PSA."radiusKm") FROM provider_service_areas PSA
                    WHERE PSA."providerProfileId" = pp.id AND PSA."isActive" = true
                  ), 0)
              )`
            : Prisma.sql`false`} THEN 20 ELSE 0 END)
      )::float AS score
    FROM provider_profiles pp
    LEFT JOIN provider_services ps
      ON ps."providerProfileId" = pp.id AND ps."isActive" = true
    -- Capacity is read from the live job count so a provider already handling
    -- three jobs ranks below one who is free, not above.
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS capacity FROM bookings b
      WHERE b."providerProfileId" = pp.id
        AND b.status IN ('ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
    ) pa2 ON true
    WHERE pp.status = 'ACTIVE'
      AND pp."deletedAt" IS NULL
      ${options.serviceId ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM provider_services ps4
        WHERE ps4."providerProfileId" = pp.id
          AND ps4."serviceId" = ${options.serviceId}::text
          AND ps4."isActive" = true
      )` : Prisma.empty}
      ${options.excludeProviderIds?.length
        ? Prisma.sql`AND pp.id NOT IN (${Prisma.join(options.excludeProviderIds)})`
        : Prisma.empty}
    GROUP BY pp.id
    ORDER BY score DESC, pp."ratingAvg" DESC, pp."completedJobs" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const hits: ProviderHit[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    headline: row.headline,
    experienceYears: row.experienceYears,
    ratingAvg: Number(row.ratingAvg),
    ratingCount: row.ratingCount,
    completedJobs: row.completedJobs,
    responseRate: Number(row.responseRate),
    distanceKm: row.distance === null ? null : Math.round(Number(row.distance) * 10) / 10,
    minPricePoisha: row.minPrice,
    coversLocation: row.coversLocation,
    isSponsored: row.isSponsored,
    verifiedTypes: row.verifiedTypes ?? [],
    openSlotCount: Number(row.openSlots),
    score: Math.round(Number(row.score) * 100) / 100,
  }));

  return { hits, total: hits.length };
}

/**
 * Records what was actually searched for. This is the launch-planning signal:
 * categories with demand but no providers become the next recruitment target,
 * rather than a guess.
 */
export async function logSearch(input: {
  userId: string | null;
  parsed: ParsedQuery;
  locationId: string | null;
  resultCount: number;
}): Promise<void> {
  await prisma.searchQueryLog
    .create({
      data: {
        userId: input.userId,
        rawQuery: input.parsed.raw.slice(0, 300),
        normalizedQuery: input.parsed.core.slice(0, 300),
        detectedLanguage: input.parsed.language,
        locationId: input.locationId,
        resultCount: input.resultCount,
      },
    })
    .catch(() => undefined); // Never fail a search because logging failed.
}
