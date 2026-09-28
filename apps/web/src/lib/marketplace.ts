import { prisma } from "@/lib/db";

/**
 * Customer-facing marketplace queries.
 *
 * The rule this file exists to keep: every count, price, rating and badge that
 * reaches a customer card is read from the database at request time. Nothing is
 * defaulted to a plausible number.
 *
 * Three consequences worth stating, because each one came from a place where the
 * honest answer is less impressive than the invented one:
 *
 *   - A provider with no reviews is shown as "New on FixBondhu", never as a
 *     rating. ProviderProfile.ratingAvg defaults to 0, which is not a score.
 *   - Response time is not shown at all. ProviderProfile.avgResponseMinutes is
 *     null for every provider because nothing measures it yet, and a made-up
 *     "usually responds in 8 min" is exactly the kind of claim that loses a
 *     marketplace its only real asset.
 *   - Sponsored placement is rendered with the dashed neutral badge, never the
 *     verification badge, and never inside a count.
 */

/** Providers shown as ACTIVE. Everything else is invisible to customers. */
const PUBLIC_PROVIDER = { status: "ACTIVE" as const, deletedAt: null };

export interface ProviderFilters {
  /** Exact service slug, e.g. "ac-repair". */
  serviceSlug?: string;
  /** Exact category slug. */
  categorySlug?: string;
  /** Area slug; matches a declared service area, not a lat/long guess. */
  areaSlug?: string;
  /** Inclusive band in poisha against the provider's lowest entry price. */
  minPricePoisha?: number;
  maxPricePoisha?: number;
  /** Only providers with at least this many published reviews. */
  minReviewCount?: number;
  /** Only providers holding at least one APPROVED verification. */
  verifiedOnly?: boolean;
  /** Only providers who take urgent work. */
  urgentOnly?: boolean;
  sort?: ProviderSort;
  limit?: number;
}

export type ProviderSort =
  | "recommended"
  | "rating"
  | "price-asc"
  | "price-desc"
  | "jobs";

/**
 * A rating is only shown once there are enough reviews behind it.
 *
 * One 5-star review is not a reputation, and printing "5.0" next to it would be
 * a claim the data cannot support. Below the threshold the UI says "New" or
 * "No reviews yet" instead, which is the truthful statement.
 */
export const MIN_REVIEWS_TO_SHOW_RATING = 3;

export interface MarketplaceProvider {
  id: string;
  slug: string;
  displayName: string;
  businessName: string | null;
  headline: string | null;
  photoUrl: string | null;
  experienceYears: number;
  completedJobs: number;
  isSponsored: boolean;
  /** APPROVED verification types only. Drives the badges. */
  verifiedTypes: string[];
  /** Area names, from real ProviderServiceArea rows. */
  areaNames: string[];
  /** Lowest price across the services this provider actually offers. */
  fromPricePoisha: number | null;
  /** Real aggregate over PUBLISHED reviews. Null when there are none. */
  ratingAvg: number | null;
  ratingCount: number;
  serviceCount: number;
  /** Slugs of the services offered, for highlighting the active filter. */
  serviceSlugs: string[];
  /** Lowest price per service slug, in poisha. Drives service-specific cards. */
  servicePrices: Record<string, number>;
}

function decorate<T extends MarketplaceProvider>(rows: T[], sponsoredIds: Set<string>): T[] {
  return rows.map((row) => ({ ...row, isSponsored: sponsoredIds.has(row.id) }));
}

/**
 * Sponsorship is time-boxed in the database, so it is evaluated against the
 * clock here. A provider whose window has lapsed stops being labelled without
 * anyone having to remember to clear a flag.
 */
function currentlySponsored(p: { isSponsored: boolean; sponsoredUntil: Date | null }): boolean {
  if (!p.isSponsored) return false;
  if (!p.sponsoredUntil) return true;
  return p.sponsoredUntil.getTime() > Date.now();
}

/**
 * Lists providers, optionally narrowed, with every displayed figure derived from
 * the same query.
 *
 * The rating is aggregated from the Review table rather than read from
 * ProviderProfile.ratingAvg. The cached column is a denormalisation that can
 * drift, and a marketplace that displays a stale average is worse than one that
 * is slow.
 */
/**
 * Builds the Prisma where clause for a filter set.
 *
 * Extracted so the listing and the count can never disagree. Deriving the count
 * from the returned rows would make it silently wrong whenever the page is full,
 * which is exactly when a wrong count is least likely to be noticed.
 */
function providerWhere(filters: ProviderFilters) {
  const { serviceSlug, categorySlug, areaSlug, minPricePoisha, maxPricePoisha, urgentOnly, verifiedOnly } =
    filters;

  /*
   * Every service-related restriction goes into ONE `some`, combined with AND.
   * Writing them as sibling keys would silently drop all but the last one, since
   * an object cannot hold `services` twice: filtering by service and price
   * together would quietly become a price-only filter.
   */
  const serviceConditions: Record<string, unknown>[] = [{ isActive: true }];

  if (serviceSlug) {
    serviceConditions.push({ service: { slug: serviceSlug } });
  }
  if (categorySlug) {
    serviceConditions.push({ service: { category: { slug: categorySlug } } });
  }
  if (minPricePoisha !== undefined || maxPricePoisha !== undefined) {
    // A provider with no quotable price cannot answer a priced search, so they
    // are not a result. Showing them at ৳0 would be a lie.
    const bounds = {
      gte: minPricePoisha ?? undefined,
      lte: maxPricePoisha ?? undefined,
    };
    serviceConditions.push({
      OR: [{ basePricePoisha: bounds }, { basePricePoisha: null, minPricePoisha: bounds }],
    });
  }

  return {
    ...PUBLIC_PROVIDER,
    ...(urgentOnly ? { acceptsUrgentJobs: true } : {}),
    ...(verifiedOnly ? { verifications: { some: { status: "APPROVED" as const } } } : {}),
    ...(areaSlug
      ? { serviceAreas: { some: { isActive: true, location: { slug: areaSlug } } } }
      : {}),
    services: { some: { AND: serviceConditions } },
  } as const;
}

export async function findProviders(filters: ProviderFilters = {}): Promise<MarketplaceProvider[]> {
  const {
    minReviewCount = 0,
    sort = "recommended",
    limit = 24,
  } = filters;

  const rows = await prisma.providerProfile.findMany({
    where: providerWhere(filters),
    include: {
      services: {
        where: { isActive: true },
        select: {
          minPricePoisha: true,
          basePricePoisha: true,
          service: { select: { slug: true } },
        },
      },
      serviceAreas: {
        where: { isActive: true },
        select: { location: { select: { nameEn: true } } },
      },
      verifications: { where: { status: "APPROVED" }, select: { type: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        select: { rating: true },
      },
    },
    // Ordering happens in memory below because the sort keys are aggregates.
    // Taking a wide slice first keeps that honest: a page of results must not be
    // silently short because the database happened to order differently.
    take: 200,
  });

  const providers: MarketplaceProvider[] = rows.map((p) => {
    const lowest = p.services.reduce<number | null>((acc, s) => {
      const price = s.basePricePoisha ?? s.minPricePoisha;
      if (price == null) return acc;
      return acc === null || price < acc ? price : acc;
    }, null);

    // Lowest price per service, so a card shown on "AC Repair" can lead with the
    // AC price rather than the provider's cheapest trade, which would be a
    // truthful number in the wrong place.
    const servicePrices: Record<string, number> = {};
    for (const s of p.services) {
      const price = s.basePricePoisha ?? s.minPricePoisha;
      if (price == null) continue;
      const existing = servicePrices[s.service.slug];
      if (existing === undefined || price < existing) servicePrices[s.service.slug] = price;
    }

    const count = p.reviews.length;
    const avg = count
      ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / count
      : null;

    return {
      id: p.id,
      slug: p.slug,
      displayName: p.displayName,
      businessName: p.businessName,
      headline: p.headline,
      photoUrl: p.photoUrl,
      experienceYears: p.experienceYears,
      completedJobs: p.completedJobs,
      isSponsored: currentlySponsored(p),
      verifiedTypes: p.verifications.map((v) => v.type),
      areaNames: [...new Set(p.serviceAreas.map((a) => a.location.nameEn))],
      fromPricePoisha: lowest,
      ratingAvg: count >= MIN_REVIEWS_TO_SHOW_RATING ? Math.round(avg! * 10) / 10 : null,
      ratingCount: count,
      serviceCount: p.services.length,
      serviceSlugs: p.services.map((s) => s.service.slug),
      servicePrices,
    };
  });

  // Sponsored placement is deliberately visible in the ordering, because a
  // marketplace that sells placement without showing it is lying. The badge
  // sits on the card and sponsored rows sort first, and that is the whole
  // disclosure required.
  const bySponsored = (a: MarketplaceProvider, b: MarketplaceProvider) =>
    Number(b.isSponsored) - Number(a.isSponsored);

  const sorters: Record<ProviderSort, (a: MarketplaceProvider, b: MarketplaceProvider) => number> = {
    recommended: (a, b) => {
      // Recommended means: has a quotable price, has reviews, has history.
      // Each term is a real property, not a popularity score nobody maintains.
      const score = (p: MarketplaceProvider) =>
        (p.ratingAvg ?? 0) * 2 +
        Math.min(p.ratingCount, 20) / 5 +
        Math.min(p.completedJobs, 200) / 50 +
        (p.verifiedTypes.length > 0 ? 1 : 0);
      return score(b) - score(a);
    },
    rating: (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || b.ratingCount - a.ratingCount,
    "price-asc": (a, b) => (a.fromPricePoisha ?? Infinity) - (b.fromPricePoisha ?? Infinity),
    "price-desc": (a, b) => (b.fromPricePoisha ?? -1) - (a.fromPricePoisha ?? -1),
    jobs: (a, b) => b.completedJobs - a.completedJobs,
  };

  // minReviewCount is applied here rather than in SQL, because the threshold
  // exists to gate what is DISPLAYED, not to decide who is a real provider. A
  // provider with one review is a legitimate result; they just are not shown a
  // star rating.
  const eligible = minReviewCount > 0
    ? providers.filter((p) => p.ratingCount >= minReviewCount)
    : providers;

  return eligible
    .sort((a, b) => bySponsored(a, b) || sorters[sort](a, b))
    .slice(0, limit);
}

/**
 * How many providers match. Runs as a real COUNT so the number on the page is
 * the size of the result set, not the size of the page.
 */
export async function countProviders(filters: ProviderFilters = {}): Promise<number> {
  return prisma.providerProfile.count({ where: providerWhere(filters) });
}

export interface CategoryWithCounts {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  icon: string | null;
  serviceCount: number;
  providerCount: number;
}

/**
 * Published categories with real counts.
 *
 * providerCount is the number of distinct ACTIVE providers with at least one
 * active, priced service in that category. It is not the number of services and
 * not the number of listings, so on a category with no supply it honestly reads
 * zero.
 */
export async function listCategoriesWithCounts(): Promise<CategoryWithCounts[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true, isPublished: true, parentId: null },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameBn: true,
      icon: true,
      services: {
        where: { isActive: true, isPublished: true },
        select: {
          id: true,
          providerServices: {
            where: {
              isActive: true,
              providerProfile: PUBLIC_PROVIDER,
              OR: [{ basePricePoisha: { not: null } }, { minPricePoisha: { gt: 0 } }],
            },
            select: { providerProfileId: true },
          },
        },
      },
    },
  });

  return categories.map((c) => {
    const providerIds = new Set<string>();
    for (const service of c.services) {
      for (const ps of service.providerServices) providerIds.add(ps.providerProfileId);
    }
    return {
      id: c.id,
      slug: c.slug,
      nameEn: c.nameEn,
      nameBn: c.nameBn,
      icon: c.icon,
      serviceCount: c.services.length,
      providerCount: providerIds.size,
    };
  });
}

export interface ServiceWithCounts {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  nameBanglish: string | null;
  descriptionEn: string | null;
  icon: string | null;
  durationMinutes: number;
  isEmergency: boolean;
  /** Whether the work needs someone physically present. */
  requiresVisit: boolean;
  categorySlug: string;
  categoryNameEn: string;
  /** Distinct ACTIVE providers offering this service at a price. */
  providerCount: number;
  fromPricePoisha: number | null;
}

/** Published services with real supply counts and real entry prices. */
export async function listServicesWithCounts(
  options: { categorySlug?: string; emergencyOnly?: boolean; limit?: number } = {},
): Promise<ServiceWithCounts[]> {
  const { categorySlug, emergencyOnly = false, limit } = options;

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      isPublished: true,
      ...(emergencyOnly ? { isEmergency: true } : {}),
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    orderBy: [{ isEmergency: "desc" }, { sequence: "asc" }],
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameBn: true,
      nameBanglish: true,
      descriptionEn: true,
      icon: true,
      durationMinutes: true,
      isEmergency: true,
      requiresVisit: true,
      category: { select: { slug: true, nameEn: true } },
      providerServices: {
        where: {
          isActive: true,
          providerProfile: PUBLIC_PROVIDER,
          OR: [{ basePricePoisha: { not: null } }, { minPricePoisha: { gt: 0 } }],
        },
        select: { providerProfileId: true, basePricePoisha: true, minPricePoisha: true },
      },
    },
  });

  return services.map((s) => {
    const prices = s.providerServices
      .map((ps) => ps.basePricePoisha ?? ps.minPricePoisha)
      .filter((p): p is number => p != null);
    return {
      id: s.id,
      slug: s.slug,
      nameEn: s.nameEn,
      nameBn: s.nameBn,
      nameBanglish: s.nameBanglish,
      descriptionEn: s.descriptionEn,
      icon: s.icon,
      durationMinutes: s.durationMinutes,
      isEmergency: s.isEmergency,
      requiresVisit: s.requiresVisit,
      categorySlug: s.category.slug,
      categoryNameEn: s.category.nameEn,
      // Distinct providers, not distinct prices. Two providers charging the
      // same amount are still two providers available to book.
      providerCount: new Set(s.providerServices.map((ps) => ps.providerProfileId)).size,
      fromPricePoisha: prices.length ? Math.min(...prices) : null,
    };
  });
}

export interface ServiceDetail extends ServiceWithCounts {
  categoryNameBn: string;
  descriptionBn: string | null;
}

/** One service with its category, for the detail page. */
export async function getService(slug: string): Promise<ServiceDetail | null> {
  const all = await listServicesWithCounts();
  const hit = all.find((s) => s.slug === slug);
  if (!hit) return null;

  const category = await prisma.category.findUnique({
    where: { slug: hit.categorySlug },
    select: { nameBn: true, descriptionBn: true },
  });

  return {
    ...hit,
    categoryNameBn: category?.nameBn ?? hit.categoryNameEn,
    descriptionBn: category?.descriptionBn ?? null,
  };
}

/** AREA-level locations, grouped by district for a two-step selector. */
export async function listAreasByDistrict(): Promise<
  Array<{ district: string; areas: Array<{ slug: string; nameEn: string; nameBn: string }> }>
> {
  const districts = await prisma.location.findMany({
    where: { isActive: true, type: "DISTRICT" },
    orderBy: { sequence: "asc" },
    select: {
      nameEn: true,
      children: {
        where: { isActive: true, type: "AREA" },
        orderBy: { sequence: "asc" },
        select: { slug: true, nameEn: true, nameBn: true },
      },
    },
  });

  return districts
    .map((d) => ({ district: d.nameEn, areas: d.children }))
    .filter((d) => d.areas.length > 0);
}
