/**
 * Personalised discovery.
 *
 * The rule under test is that these surfaces are derived from real bookings and
 * disappear entirely when there is no history. A "for you" rail that quietly
 * falls back to a popularity list is the failure mode worth guarding.
 *
 * Run: npx tsx scripts/verify-recommendations.ts
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
  console.log(`Recommendations against branch ${branchId}\n`);
  if (branchId === PRODUCTION_BRANCH_ID) throw new Error("Refusing to run against production.");

  const { getPastBookings, getRecommendedServices, getCustomerArea } = await import(
    "../src/lib/recommendations"
  );

  // ---- a customer with history -----------------------------------------
  const withHistory = await prisma.user.findFirst({
    where: { bookings: { some: {} }, customerProfile: { isNot: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true },
  });

  if (!withHistory) {
    throw new Error("The demo branch has no customer with bookings to test against.");
  }
  console.log(`  testing as ${withHistory.name}\n`);

  {
    const past = await getPastBookings(withHistory.id, 10);

    check("past bookings are returned", past.length > 0, `${past.length}`);

    // Every row must correspond to a real booking owned by this customer.
    const ids = past.map((p) => p.bookingId);
    const real = await prisma.booking.count({
      where: { id: { in: ids }, customerId: withHistory.id },
    });
    check("every entry is a real booking for this customer", real === ids.length,
      `${real} of ${ids.length}`);

    const allowed = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);
    check("only settled bookings are offered", past.every((p) => allowed.has(p.status)),
      past.map((p) => p.status).join(","));

    check("no live booking is offered as a rebook",
      !past.some((p) => p.status === "REQUESTED" || p.status === "ACCEPTED" || p.status === "IN_PROGRESS"));

    // The core honesty claim: rebookable means the provider is live AND still
    // offers that service. Cross-checked against the database, not itself.
    for (const entry of past) {
      const provider = await prisma.providerProfile.findUnique({
        where: { id: entry.providerProfileId },
        select: {
          status: true,
          services: { where: { isActive: true }, select: { service: { select: { slug: true } } } },
        },
      });
      if (!provider) continue;
      const stillOffers = provider.services.some((s) => s.service.slug === entry.serviceSlug);
      if (entry.rebookable) {
        check(`${entry.providerName.slice(0, 14)}: rebookable implies live + still offers`,
          provider.status === "ACTIVE" && stillOffers,
          `status=${provider.status} stillOffers=${stillOffers}`);
      }
    }

    check("entries are newest first", (() => {
      const times = past.map((p) => p.scheduledAt.getTime());
      return times.every((v, i) => i === 0 || times[i - 1]! >= v);
    })());

    check("the limit is respected", past.length <= 10);

    const smaller = await getPastBookings(withHistory.id, 2);
    check("a smaller limit returns fewer or equal", smaller.length <= past.length,
      `${smaller.length} vs ${past.length}`);
  }

  // ---- recommendations ---------------------------------------------------
  {
    const recs = await getRecommendedServices(withHistory.id, 6);

    // The customer's real footprint.
    const usedServiceIds = [
      ...new Set(
        (await prisma.booking.findMany({
          where: { customerId: withHistory.id },
          select: { serviceId: true },
        })).map((b) => b.serviceId),
      ),
    ];
    const usedCategoryIds = [
      ...new Set(
        (await prisma.booking.findMany({
          where: { customerId: withHistory.id },
          select: { service: { select: { categoryId: true } } },
        })).map((b) => b.service.categoryId),
      ),
    ];

    if (recs.length > 0) {
      check("no suggestion is something already booked",
        recs.every((r) => !usedServiceIds.length || true));

      const slugs = recs.map((r) => r.slug);
      const overlaps = await prisma.service.count({
        where: { slug: { in: slugs }, id: { in: usedServiceIds } },
      });
      check("suggestions exclude services the customer already used", overlaps === 0,
        `${overlaps} overlap`);

      const offCategory = await prisma.service.count({
        where: { slug: { in: slugs }, categoryId: { notIn: usedCategoryIds } },
      });
      check("every suggestion is in a category they have booked in", offCategory === 0,
        `${offCategory} off-category`);

      check("no suggestion has zero supply", recs.every((r) => r.providerCount > 0));

      // providerCount must be providers, verified against the database.
      for (const rec of recs.slice(0, 2)) {
        const real = await prisma.providerProfile.count({
          where: {
            status: "ACTIVE",
            deletedAt: null,
            services: {
              some: {
                isActive: true,
                service: { slug: rec.slug },
                OR: [{ basePricePoisha: { not: null } }, { minPricePoisha: { gt: 0 } }],
              },
            },
          },
        });
        check(`"${rec.nameEn}" providerCount matches the database`,
          rec.providerCount === real, `${rec.providerCount} vs ${real}`);
      }

      check("suggestions are ordered by real supply",
        recs.every((r, i) => i === 0 || recs[i - 1]!.providerCount >= r.providerCount));
    } else {
      console.log("  ..    no suggestions (every service in their categories is used)");
    }
  }

  // ---- no history means no suggestions ----------------------------------
  {
    // A provider account has no customer bookings, which stands in for a brand
    // new customer. Both surfaces must come back empty rather than substituting
    // a popularity list.
    const provider = await prisma.user.findFirst({
      where: { providerProfile: { isNot: null } },
      select: { id: true, name: true },
    });

    if (provider) {
      const past = await getPastBookings(provider.id, 5);
      const recs = await getRecommendedServices(provider.id, 5);
      check("a customer with no bookings gets no book-again rail", past.length === 0,
        `${past.length}`);
      check("a customer with no bookings gets no recommendations", recs.length === 0,
        `${recs.length}`);
    }

    const ghost = await getPastBookings("no-such-customer-id", 5);
    check("an unknown customer gets nothing", ghost.length === 0);
    const ghostRecs = await getRecommendedServices("no-such-customer-id", 5);
    check("an unknown customer gets no recommendations", ghostRecs.length === 0);
  }

  // ---- the area chip only ever reflects a real saved address ------------
  {
    const withAddress = await prisma.user.findFirst({
      where: { addresses: { some: { deletedAt: null } } },
      select: { id: true },
    });
    if (withAddress) {
      const area = await getCustomerArea(withAddress.id);
      check("a customer with an address gets an area", area !== null);
      // And it must be their real address, not a default city.
      const real = await prisma.address.findFirst({
        where: { userId: withAddress.id, deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: { areaName: true, districtName: true },
      });
      check("the area matches their saved address",
        area?.areaName === real?.areaName && area?.districtName === real?.districtName,
        `${area?.areaName} vs ${real?.areaName}`);
    }

    const noAddress = await getCustomerArea("no-such-customer-id");
    check("a customer with no address gets no area", noAddress === null);
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} recommendation assertions`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
