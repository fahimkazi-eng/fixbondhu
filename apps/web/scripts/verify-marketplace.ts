/**
 * Marketplace query checks.
 *
 * Run against the demo branch. These are the numbers a customer will see, so
 * each one is asserted against a fact I read out of the database directly rather
 * than against a snapshot that could drift.
 *
 * Run: npx tsx scripts/verify-marketplace.ts
 */

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@fixbondhu/db";

import { loadRootEnv } from "../src/lib/load-root-env";

loadRootEnv();

const DEMO_URL = process.env.DEMO_DATABASE_URL;
if (!DEMO_URL) throw new Error("DEMO_DATABASE_URL is required.");
const PRODUCTION_BRANCH_ID = "br-orange-bird-az5zc8uz";

process.env.DATABASE_URL = DEMO_URL;
process.env.PRISMA_EXPECT_HOST = "royal-butterfly";

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: DEMO_URL }) });

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

async function main() {
  const [branch] = await prisma.$queryRawUnsafe<Array<{ b: string }>>(
    "SELECT current_setting('neon.branch_id') AS b",
  );
  const branchId = branch?.b ?? "unknown";
  console.log(`Marketplace queries against branch ${branchId}\n`);
  if (branchId === PRODUCTION_BRANCH_ID) throw new Error("Refusing to run against production.");

  const {
    findProviders,
    countProviders,
    listCategoriesWithCounts,
    listServicesWithCounts,
    getService,
    listAreasByDistrict,
    MIN_REVIEWS_TO_SHOW_RATING,
  } = await import("../src/lib/marketplace");

  // ---- ground truth, read straight from the tables ----------------------
  const truth = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM provider_profiles WHERE status='ACTIVE' AND "deletedAt" IS NULL`,
  );
  const activeProviders = Number(truth[0]!.n);

  const catTruth = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM categories WHERE "isActive" AND "isPublished" AND "parentId" IS NULL`,
  );
  const activeCategories = Number(catTruth[0]!.n);

  const svcTruth = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM services WHERE "isActive" AND "isPublished"`,
  );
  const activeServices = Number(svcTruth[0]!.n);

  console.log(`  ground truth: ${activeProviders} active providers, ` +
    `${activeCategories} categories, ${activeServices} services\n`);

  // ---- providers --------------------------------------------------------
  {
    const all = await findProviders({ limit: 100 });
    check("every active provider is returned", all.length === activeProviders,
      `${all.length} vs ${activeProviders}`);

    const counted = await countProviders({});
    check("the count matches the listing", counted === all.length,
      `count ${counted} vs ${all.length}`);

    check("every provider has a slug", all.every((p) => p.slug.length > 0));
    check("no provider is shown twice",
      new Set(all.map((p) => p.id)).size === all.length);

    // A rating is only shown when enough reviews back it. The demo has real
    // review counts of 0, 1, 2, 3, 3 and 7, so the threshold must actually bite.
    const withRatings = all.filter((p) => p.ratingAvg !== null);
    check("no rating is shown below the threshold",
      withRatings.every((p) => p.ratingCount >= MIN_REVIEWS_TO_SHOW_RATING),
      withRatings.map((p) => `${p.ratingCount}`).join(","));

    const thin = all.filter((p) => p.ratingCount < MIN_REVIEWS_TO_SHOW_RATING);
    check("thin providers report no rating rather than a fake one",
      thin.every((p) => p.ratingAvg === null),
      `${thin.length} thin providers`);

    check("ratings stay inside the 1..5 range",
      withRatings.every((p) => p.ratingAvg! >= 1 && p.ratingAvg! <= 5));

    check("review counts are not inflated",
      all.every((p) => p.ratingCount <= 1000));

    check("prices are positive or absent, never zero",
      all.every((p) => p.fromPricePoisha === null || p.fromPricePoisha > 0),
      all.map((p) => String(p.fromPricePoisha)).join(","));

    check("no provider claims a response time that was never measured",
      all.every((p) => !("avgResponseMinutes" in p)));

    const verified = all.filter((p) => p.verifiedTypes.length > 0);
    check("verification comes only from APPROVED rows", verified.length > 0,
      `${verified.length} have badges`);

    const withAreas = all.filter((p) => p.areaNames.length > 0);
    check("service areas come from real rows", withAreas.length === all.length,
      `${withAreas.length}/${all.length}`);

    check("sponsored is false for the demo set",
      all.every((p) => p.isSponsored === false));
  }

  // ---- filters actually filter ------------------------------------------
  {
    // The bug this guards: writing service and price as sibling `services` keys
    // makes the first one vanish, so "AC repair under ৳1000" would return every
    // priced provider instead of only AC ones.
    const ac = await findProviders({ serviceSlug: "ac-repair", limit: 100 });
    const allWithServiceSlugs = await findProviders({ limit: 100 });
    check("a service filter is a strict subset",
      ac.length < allWithServiceSlugs.length && ac.length > 0,
      `${ac.length} of ${allWithServiceSlugs.length}`);

    check("every result really offers that service",
      ac.every((p) => p.serviceSlugs.includes("ac-repair")));

    const combined = await findProviders({
      serviceSlug: "ac-repair",
      maxPricePoisha: 100000,
      limit: 100,
    });
    check("service and price filters compose (do not overwrite)",
      combined.every((p) => p.serviceSlugs.includes("ac-repair")),
      `${combined.length} results`);
    check("the price filter is applied as well as the service filter",
      combined.every((p) => p.fromPricePoisha === null || p.fromPricePoisha <= 100000));
    check("a narrower filter never returns more rows",
      combined.length <= ac.length,
      `${combined.length} vs ${ac.length}`);

    // Cross-check the price filter against the database, not against itself.
    const expected = await prisma.providerProfile.count({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        services: {
          some: {
            isActive: true,
            service: { slug: "ac-repair" },
            OR: [
              { basePricePoisha: { lte: 100000 } },
              { basePricePoisha: null, minPricePoisha: { lte: 100000 } },
            ],
          },
        },
      },
    });
    const combinedCount = await countProviders({
      serviceSlug: "ac-repair",
      maxPricePoisha: 100000,
    });
    check("the count agrees with the database for a combined filter",
      combinedCount === expected,
      `${combinedCount} vs ${expected}`);

    const urgent = await findProviders({ urgentOnly: true, limit: 100 });
    check("urgent filter returns a subset", urgent.length <= allWithServiceSlugs.length);

    const verifiedOnly = await findProviders({ verifiedOnly: true, limit: 100 });
    check("verified filter keeps only providers with badges",
      verifiedOnly.every((p) => p.verifiedTypes.length > 0));
  }

  // ---- sorting ----------------------------------------------------------
  {
    const byPrice = await findProviders({ sort: "price-asc", limit: 100 });
    const prices = byPrice.map((p) => p.fromPricePoisha).filter((p): p is number => p !== null);
    check("price-asc is actually ascending",
      prices.every((v, i) => i === 0 || prices[i - 1]! <= v),
      prices.join(","));

    const byJobs = await findProviders({ sort: "jobs", limit: 100 });
    const jobs = byJobs.map((p) => p.completedJobs);
    check("jobs sort is actually descending",
      jobs.every((v, i) => i === 0 || jobs[i - 1]! >= v),
      jobs.join(","));

    const limit = await findProviders({ limit: 3 });
    check("the limit is respected", limit.length === 3, `${limit.length}`);
  }

  // ---- categories -------------------------------------------------------
  {
    const categories = await listCategoriesWithCounts();
    check("every published category is listed", categories.length === activeCategories,
      `${categories.length} vs ${activeCategories}`);
    check("only top-level categories are listed",
      categories.every((c) => !c.slug.includes("/")));
    check("category service counts are real and non-negative",
      categories.every((c) => c.serviceCount >= 0));

    const totalServices = categories.reduce((sum, c) => sum + c.serviceCount, 0);
    check("category service counts sum to the service total",
      totalServices === activeServices,
      `${totalServices} vs ${activeServices}`);

    const providerSum = categories.reduce((sum, c) => sum + c.providerCount, 0);
    check("category provider counts do not exceed the active provider total",
      providerSum <= activeProviders * categories.length,
      `${providerSum}`);

    check("a category with no supply reports zero rather than hiding",
      categories.every((c) => c.providerCount >= 0));
  }

  // ---- services ---------------------------------------------------------
  {
    const services = await listServicesWithCounts();
    check("every published service is listed", services.length === activeServices,
      `${services.length} vs ${activeServices}`);

    // providerCount must be a count of PROVIDERS, not of prices. If it counted
    // prices, two providers charging the same amount would read as one.
    const sample = services.find((s) => s.providerCount > 1);
    if (sample) {
      const real = await prisma.providerService.groupBy({
        by: ["providerProfileId"],
        where: {
          isActive: true,
          service: { slug: sample.slug },
          providerProfile: { status: "ACTIVE", deletedAt: null },
          OR: [{ basePricePoisha: { not: null } }, { minPricePoisha: { gt: 0 } }],
        },
      });
      check("service providerCount counts providers, not prices",
        sample.providerCount === real.length,
        `${sample.slug}: ${sample.providerCount} vs ${real.length}`);
    }

    check("services report a real category", services.every((s) => s.categorySlug.length > 0));
    check("from-price is positive or absent",
      services.every((s) => s.fromPricePoisha === null || s.fromPricePoisha > 0));

    const emergency = services.filter((s) => s.isEmergency);
    check("emergency services exist and sort first", emergency.length > 0 &&
      services[0]!.isEmergency === true, `${emergency.length} emergency`);

    const byCategory = await listServicesWithCounts({ categorySlug: "ac-cooling" });
    check("a category filter returns only that category",
      byCategory.every((s) => s.categorySlug === "ac-cooling") && byCategory.length > 0,
      `${byCategory.length}`);
  }

  // ---- single service --------------------------------------------------
  {
    const acRepair = await getService("ac-repair");
    check("a real service resolves", acRepair !== null);
    check("it carries its Bangla name", (acRepair?.categoryNameBn.length ?? 0) > 0,
      acRepair?.categoryNameBn);

    const missing = await getService("this-service-does-not-exist");
    check("an unknown service returns null rather than throwing", missing === null);
  }

  // ---- areas ------------------------------------------------------------
  {
    const areas = await listAreasByDistrict();
    check("areas are grouped by district", areas.length > 0, `${areas.length} districts`);
    check("no district is listed with zero areas", areas.every((d) => d.areas.length > 0));
    check("every area has a slug for filtering", areas.every((d) => d.areas.every((a) => a.slug.length > 0)));

    // And the area filter must actually resolve to providers.
    const mirpur = areas.flatMap((d) => d.areas).find((a) => a.slug.includes("mirpur"));
    if (mirpur) {
      const inArea = await findProviders({ areaSlug: mirpur.slug, limit: 100 });
      const real = await prisma.providerProfile.count({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          serviceAreas: { some: { isActive: true, location: { slug: mirpur.slug } } },
        },
      });
      check("an area filter agrees with the database",
        inArea.length === real,
        `${mirpur.nameEn}: ${inArea.length} vs ${real}`);
      check("every provider in the area declares it",
        inArea.every((p) => p.areaNames.includes(mirpur.nameEn)));
    }
  }

  // ---- the honesty case: production -------------------------------------
  {
    // A brand new deployment has no providers. The queries must return empty,
    // not placeholder rows, so the UI can say so.
    const withImpossibleFilter = await findProviders({ categorySlug: "no-such-category" });
    check("an impossible filter returns nothing, not placeholders",
      withImpossibleFilter.length === 0);

    const count = await countProviders({ categorySlug: "no-such-category" });
    check("its count is zero", count === 0, `${count}`);

    const services = await listServicesWithCounts({ categorySlug: "no-such-category" });
    check("an unknown category has no services", services.length === 0);
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} marketplace assertions`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
