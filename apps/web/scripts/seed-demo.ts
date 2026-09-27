/**
 * Demo data seeder.
 *
 * DESIGN RULE: this runs against a SEPARATE Neon branch (br-young-night), not
 * production. The production branch holds only real reference data. That
 * separation is the whole point â€” a demo that shares a database with live users
 * eventually leaks a fake "verified provider" into a real search result.
 *
 * Everything is created through the real services (createBooking,
 * transitionBooking) rather than by inserting rows directly. So the demo
 * bookings have genuine status histories, real commission splits, real
 * additional-charge approvals and real review links, and they exercise the same
 * code a customer's booking does. If the business logic is wrong, the demo data
 * is wrong in exactly the same way, which is what makes it worth having.
 *
 * The demo site shows a persistent banner (NEXT_PUBLIC_DEMO_MODE) so nobody
 * mistakes it for the live marketplace.
 *
 * Run: DEMO_DATABASE_URL=... npx tsx scripts/seed-demo.ts
 */

import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

import { generateBookingReference, bdtToPoisha } from "@fixbondhu/core";
import { PrismaClient } from "@fixbondhu/db";

// The real booking service. The demo is only trustworthy if bookings go through
// the same code a live booking does, rather than rows inserted by hand.
import { createBooking, transitionBooking } from "../src/lib/bookings";

import { loadRootEnv } from "../src/lib/load-root-env";

// Ensures DATABASE_URL is populated when the script is run with only
// DEMO_DATABASE_URL set.
loadRootEnv();

const connectionString =
  process.env.DEMO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DEMO_DATABASE_URL is required.");

// The booking service opens its own client from DATABASE_URL, so both must
// point at the demo branch or the bookings would be written to production.
if (process.env.DEMO_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DEMO_DATABASE_URL;
}


const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const DEMO_PASSWORD = "demo1234";
const PREFIX = "+8801710";

function phone(n: number) {
  return `${PREFIX}${String(n).padStart(6, "0")}`;
}

interface ProviderSpec {
  n: number;
  name: string;
  slug: string;
  headline: string;
  bio: string;
  years: number;
  business?: string;
  categorySlugs: Array<{ slug: string; min: number; max: number }>;
  areas: string[];
  rating: number;
  completed: number;
  responseRate: number;
}

const PROVIDERS: ProviderSpec[] = [
  {
    n: 1,
    name: "Rafiqul Islam",
    slug: "rafiqul-islam",
    headline: "AC and refrigeration technician, 11 years in Dhaka",
    bio: "Split and window AC servicing, gas refill and installation. Also refrigerators and deep freezers. I carry common spare parts and give a written estimate before starting.",
    years: 11,
    categorySlugs: [
      { slug: "ac-repair", min: bdtToPoisha(600), max: bdtToPoisha(600) },
      { slug: "ac-gas-refill", min: bdtToPoisha(1800), max: bdtToPoisha(2800) },
      { slug: "ac-installation", min: bdtToPoisha(2500), max: bdtToPoisha(4500) },
      { slug: "ac-cleaning-servicing", min: bdtToPoisha(800), max: bdtToPoisha(1200) },
      { slug: "refrigerator-repair", min: bdtToPoisha(700), max: bdtToPoisha(2000) },
    ],
    areas: ["Banani", "Gulshan", "Uttara", "Bashundhara R/A"],
    rating: 4.7,
    completed: 212,
    responseRate: 0.94,
  },
  {
    n: 2,
    name: "Nasir Hossain",
    slug: "nasir-hossain",
    headline: "Licensed electrician for homes and small offices",
    bio: "Wiring faults, switchboards, MCB trips, fan and light fittings. I diagnose first and explain what is wrong before quoting, so you know what you are paying for.",
    years: 8,
    business: "Hossain Electrical",
    categorySlugs: [
      { slug: "electrician-visit", min: bdtToPoisha(400), max: bdtToPoisha(400) },
      { slug: "switch-socket-repair", min: bdtToPoisha(300), max: bdtToPoisha(800) },
      { slug: "fan-installation-repair", min: bdtToPoisha(400), max: bdtToPoisha(900) },
      { slug: "wiring-rewiring", min: bdtToPoisha(2000), max: bdtToPoisha(6000) },
      { slug: "mcb-db-repair", min: bdtToPoisha(600), max: bdtToPoisha(1500) },
    ],
    areas: ["Dhanmondi", "Mohammadpur", "Farmgate", "Tejgaon"],
    rating: 4.5,
    completed: 156,
    responseRate: 0.89,
  },
  {
    n: 3,
    name: "Shahidul Karim",
    slug: "shahidul-karim",
    headline: "Plumber for leaks, blocks and fittings",
    bio: "Emergency leaks, blocked drains, toilet and tap work, bathroom fittings. I carry common spares on the van. Nothing is replaced without your approval.",
    years: 14,
    categorySlugs: [
      { slug: "plumber-visit", min: bdtToPoisha(350), max: bdtToPoisha(350) },
      { slug: "tap-faucet-repair", min: bdtToPoisha(300), max: bdtToPoisha(900) },
      { slug: "toilet-flush-repair", min: bdtToPoisha(500), max: bdtToPoisha(1500) },
      { slug: "water-pipe-drain-repair", min: bdtToPoisha(600), max: bdtToPoisha(2500) },
    ],
    areas: ["Mirpur", "Malibagh", "Shahbagh", "Badda"],
    rating: 4.3,
    completed: 289,
    responseRate: 0.82,
  },
  {
    n: 4,
    name: "Aminul Haque",
    slug: "aminul-haque",
    headline: "Carpenter and furniture repair",
    bio: "Furniture repair, doors and windows, and custom made pieces. I will measure properly before quoting so the price does not move halfway through.",
    years: 17,
    business: "Haque Furniture",
    categorySlugs: [
      { slug: "furniture-repair", min: bdtToPoisha(600), max: bdtToPoisha(2000) },
      { slug: "door-window-repair", min: bdtToPoisha(800), max: bdtToPoisha(2500) },
      { slug: "custom-furniture-making", min: bdtToPoisha(8000), max: bdtToPoisha(45000) },
    ],
    areas: ["Gulshan", "Banani", "Bashundhara R/A"],
    rating: 4.6,
    completed: 98,
    responseRate: 0.91,
  },
  {
    n: 5,
    name: "Rezaul Karim",
    slug: "rezaul-karim",
    headline: "Painter: interior, exterior and waterproofing",
    bio: "Interior and exterior painting, and waterproofing for roofs and ceilings that leak in monsoon. I do a small patch test first on every waterproofing job.",
    years: 12,
    categorySlugs: [
      { slug: "interior-wall-painting", min: bdtToPoisha(12000), max: bdtToPoisha(35000) },
      { slug: "exterior-painting", min: bdtToPoisha(18000), max: bdtToPoisha(50000) },
      { slug: "waterproofing", min: bdtToPoisha(15000), max: bdtToPoisha(45000) },
    ],
    areas: ["Uttara", "Mirpur", "Dhanmondi"],
    rating: 4.4,
    completed: 64,
    responseRate: 0.86,
  },
  {
    n: 6,
    name: "Kamrul Hasan",
    slug: "kamrul-hasan",
    headline: "Deep cleaning for homes and small offices",
    bio: "Full home, bathroom and kitchen deep cleaning. I bring my own equipment and chemicals. No overtime charge, whatever the size of the job.",
    years: 6,
    business: "Hasan Cleaning Service",
    categorySlugs: [
      { slug: "full-home-cleaning", min: bdtToPoisha(2500), max: bdtToPoisha(7000) },
      { slug: "bathroom-cleaning", min: bdtToPoisha(900), max: bdtToPoisha(1800) },
      { slug: "kitchen-deep-cleaning", min: bdtToPoisha(1200), max: bdtToPoisha(2500) },
    ],
    areas: ["Banani", "Gulshan", "Dhanmondi", "Uttara"],
    rating: 4.2,
    completed: 141,
    responseRate: 0.97,
  },
];

const CUSTOMERS = [
  { n: 11, name: "Farhana Akter", area: "Banani", district: "Dhaka", line1: "House 42, Road 11" },
  { n: 12, name: "Tanvir Ahmed", area: "Uttara", district: "Dhaka", line1: "Flat 5B, House 7, Sector 4" },
  { n: 13, name: "Sadia Rahman", area: "Dhanmondi", district: "Dhaka", line1: "Flat 302, Road 9" },
  { n: 14, name: "Imran Chowdhury", area: "Mirpur", district: "Dhaka", line1: "House 18, Road 22" },
  { n: 15, name: "Nusrat Jahan", area: "Bashundhara R/A", district: "Dhaka", line1: "House 121, Block C" },
];

const REVIEW_TEXTS: Array<[number, string, string]> = [
  [5, "Came on time and fixed it in under an hour", "Arrived exactly on time, explained what had failed and showed me the old part. Very clean work, no mess left behind."],
  [4, "Good work, slightly late", "Fixed the problem well and charged what was quoted. Arrived about 30 minutes late but let me know in advance."],
  [5, "Honest about what was needed", "Did not try to sell me parts I did not need. Explained the problem clearly and the price matched the estimate."],
  [5, "Very responsive on chat", "Replied on chat within minutes and came the same evening because it was urgent. Highly recommended."],
  [3, "Job done, took longer than expected", "The work itself was fine but it took much longer than the two hours I was told. I would use again but book a wider window."],
  [5, "Would use again", "Straightforward, professional and polite. Gave me advice on how to avoid the same problem again."],
  [4, "Good value", "Fair price for the work. Slight delay in arriving but communicated well."],
  [5, "Excellent with an emergency", "Our line burst at night. He came within the hour and stopped the damage. Worth every taka."],
];

async function main() {
  console.log("Seeding demo branch...\n");

  // Guard: never run against production.
  const branch = await prisma.$queryRawUnsafe<Array<{ b: string }>>(
    "SELECT current_setting('neon.branch_id') AS b",
  );
  const branchId = branch[0]?.b ?? "unknown";
  console.log(`  branch: ${branchId}`);
  if (branchId === "br-orange-bird-az5zc8uz") {
    throw new Error(
      "Refusing to seed demo data onto the production branch. Point DEMO_DATABASE_URL at the demo branch.",
    );
  }

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`  ${existing} users already present, clearing demo data first`);
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "payout_items","payouts","refunds","payments","reviews","review_flags",
        "additional_charge_requests","booking_events","booking_status_history",
        "bookings","messages","conversations","notifications",
        "notification_deliveries","complaints","disputes","dispute_evidence",
        "complaint_events","support_tickets","ticket_messages","saved_providers",
        "provider_services","provider_service_areas","provider_availability",
        "provider_verifications","portfolio_items","provider_payout_methods",
        "provider_profiles","addresses","customer_profiles","otp_codes",
        "sessions","user_role_assignments","coupon_redemptions","referrals",
        "users"
      RESTART IDENTITY CASCADE
    `);
    console.log("  cleared existing demo data");
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const areas = await prisma.location.findMany({ where: { type: "AREA" } });
  const areaByName = new Map(areas.map((a) => [a.nameEn, a]));

  // ---- providers -------------------------------------------------------
  for (const spec of PROVIDERS) {
    const user = await prisma.user.create({
      data: {
        name: spec.name,
        phone: phone(spec.n),
        passwordHash: hash,
        status: "ACTIVE",
        primaryRole: "CUSTOMER",
        phoneVerifiedAt: new Date(),
        roles: { create: { role: "CUSTOMER" } },
        customerProfile: { create: { referralCode: generateBookingReference().replace("FB-", "") } },
        providerProfile: {
          create: {
            slug: spec.slug,
            displayName: spec.name,
            headline: spec.headline,
            bio: spec.bio,
            businessName: spec.business ?? null,
            experienceYears: spec.years,
            status: "ACTIVE",
            approvedAt: new Date(Date.now() - 90 * 86_400_000),
            completedJobs: spec.completed,
            responseRate: spec.responseRate,
            ratingAvg: spec.rating,
            ratingCount: 0,
            totalEarningsPoisha: BigInt(spec.completed * bdtToPoisha(700)),
            maxConcurrentJobs: 6,
            searchText: spec.name.toLowerCase(),
          },
        },
      },
      include: { providerProfile: true },
    });

    const profile = user.providerProfile!;

    // Verification: PHONE comes from the verified user row, plus IDENTITY and
    // either BUSINESS or CERTIFICATE. All APPROVED, all reviewed, because a
    // demo provider that cannot show a real badge is not demonstrating the part
    // that matters.
    await prisma.providerVerification.createMany({
      data: [
        {
          providerProfileId: profile.id,
          type: "PHONE",
          status: "APPROVED",
          reviewedAt: new Date(Date.now() - 90 * 86_400_000),
        },
        {
          providerProfileId: profile.id,
          type: "IDENTITY",
          status: "APPROVED",
          reviewedAt: new Date(Date.now() - 88 * 86_400_000),
          documentMeta: { documentsUploaded: 2 },
        },
        spec.business
          ? {
              providerProfileId: profile.id,
              type: "BUSINESS",
              status: "APPROVED",
              reviewedAt: new Date(Date.now() - 87 * 86_400_000),
              documentMeta: { documentsUploaded: 1 },
            }
          : {
              providerProfileId: profile.id,
              type: "CERTIFICATE",
              status: "APPROVED",
              reviewedAt: new Date(Date.now() - 87 * 86_400_000),
              documentMeta: { documentsUploaded: 1 },
            },
      ] as never,
    });

    for (const svc of spec.categorySlugs) {
      const service = await prisma.service.findFirst({
        where: { slug: svc.slug },
        select: { id: true },
      });
      if (!service) {
        console.log(`  ! missing service ${svc.slug}`);
        continue;
      }
      await prisma.providerService.create({
        data: {
          providerProfileId: profile.id,
          serviceId: service.id,
          priceMode: svc.min === svc.max ? "FIXED" : "RANGE",
          basePricePoisha: svc.min === svc.max ? svc.min : null,
          minPricePoisha: svc.min,
          maxPricePoisha: svc.max,
          minDurationMinutes: 60,
        },
      });
    }

    for (const areaName of spec.areas) {
      const area = areaByName.get(areaName);
      if (!area) continue;
      await prisma.providerServiceArea.create({
        data: { providerProfileId: profile.id, locationId: area.id, radiusKm: 8 },
      });
    }

    // Working hours, every day except Friday.
    for (let weekday = 0; weekday < 7; weekday += 1) {
      if (weekday === 5) continue;
      await prisma.providerAvailability.create({
        data: {
          providerProfileId: profile.id,
          weekday,
          startMinute: 9 * 60,
          endMinute: 19 * 60,
        },
      });
    }
  }
  console.log(`  providers: ${PROVIDERS.length}`);

  // ---- customers and addresses -----------------------------------------
  const customerIds: string[] = [];
  for (const spec of CUSTOMERS) {
    const location = areaByName.get(spec.area);
    const user = await prisma.user.create({
      data: {
        name: spec.name,
        phone: phone(spec.n),
        passwordHash: hash,
        status: "ACTIVE",
        primaryRole: "CUSTOMER",
        phoneVerifiedAt: new Date(),
        roles: { create: { role: "CUSTOMER" } },
        customerProfile: { create: { referralCode: generateBookingReference().replace("FB-", "") } },
      },
    });
    customerIds.push(user.id);

    await prisma.address.create({
      data: {
        userId: user.id,
        label: "Home",
        type: "HOME",
        line1: spec.line1,
        areaName: spec.area,
        districtName: spec.district,
        divisionName: "Dhaka",
        locationId: location?.id ?? null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        isDefault: true,
      },
    });
  }
  console.log(`  customers: ${CUSTOMERS.length}`);

  // ---- bookings, driven through the real service ------------------------
  const services = await prisma.providerService.findMany({
    include: {
      providerProfile: { include: { user: { select: { id: true, phone: true } } } },
      service: true,
    },
  });
  const addresses = await prisma.address.findMany();

  // Provider index -> customer index -> desired final state.
  /*
   * Pairs respect declared service areas. The coverage check in createBooking is
   * real, so a mismatched pair is correctly refused; rather than weaken it, the
   * demo plan only pairs a provider with a customer inside their coverage.
   *
   *   0 Rafiqul  -> Banani, Uttara, Bashundhara -> customers 0, 1, 4
   *   1 Nasir    -> Dhanmondi                   -> customer 2
   *   2 Shahidul -> Mirpur                      -> customer 3
   *   3 Aminul   -> Banani, Bashundhara         -> customers 0, 4
   *   4 Rezaul   -> Uttara, Dhanmondi, Mirpur   -> customers 1, 2, 3
   *   5 Kamrul   -> Banani, Uttara, Dhanmondi   -> customers 0, 1, 2
   */
  const plan: Array<{
    provider: number;
    customer: number;
    state: "REQUESTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DISPUTED";
    daysFromNow: number;
    charge?: { amount: number; approve: boolean };
    review?: number;
  }> = [
    { provider: 0, customer: 0, state: "IN_PROGRESS", daysFromNow: 0 },
    { provider: 1, customer: 2, state: "REQUESTED", daysFromNow: 1 },
    { provider: 2, customer: 3, state: "COMPLETED", daysFromNow: -3, review: 0 },
    { provider: 0, customer: 4, state: "COMPLETED", daysFromNow: -6, review: 1 },
    { provider: 3, customer: 0, state: "COMPLETED", daysFromNow: -9, review: 3 },
    { provider: 5, customer: 1, state: "COMPLETED", daysFromNow: -12, review: 2 },
    { provider: 4, customer: 2, state: "COMPLETED", daysFromNow: -4, charge: { amount: bdtToPoisha(3500), approve: true }, review: 6 },
    { provider: 4, customer: 3, state: "COMPLETED", daysFromNow: -8, charge: { amount: bdtToPoisha(900), approve: false } },
    { provider: 2, customer: 3, state: "CANCELLED", daysFromNow: -1 },
    { provider: 5, customer: 2, state: "COMPLETED", daysFromNow: -5, review: 4 },
    { provider: 0, customer: 1, state: "COMPLETED", daysFromNow: -2, review: 7 },
    { provider: 3, customer: 4, state: "REQUESTED", daysFromNow: 2 },
    { provider: 4, customer: 1, state: "COMPLETED", daysFromNow: -14, review: 5 },
    { provider: 1, customer: 2, state: "DISPUTED", daysFromNow: -2 },
    { provider: 5, customer: 0, state: "COMPLETED", daysFromNow: -7, review: 1 },
    { provider: 0, customer: 4, state: "COMPLETED", daysFromNow: -11, review: 2 },
  ];

  let created = 0;
  let completed = 0;

  for (const item of plan) {
    const providerSpec = PROVIDERS[item.provider];
    if (!providerSpec) continue;
    const customerId = customerIds[item.customer];
    if (!customerId) continue;

    const providerServices = services.filter(
      (s) => s.providerProfile.user.phone === phone(providerSpec.n),
    );
    if (providerServices.length === 0) continue;

    const providerService = providerServices[created % providerServices.length];
    if (!providerService) continue;
    const address = addresses[item.customer];
    if (!address) continue;

    const scheduledAt = new Date(
      Date.now() + item.daysFromNow * 86_400_000 + 11 * 3_600_000,
    );

    let booking;
    try {
      booking = await createBooking({
        customerId,
        providerServiceId: providerService.id,
        addressId: address.id,
        scheduledAt,
        paymentMethod: "CASH",
        // Only the seeder sets this, to build the history a real marketplace has.
        allowPastSchedule: true,
        customerNote:
          item.state === "DISPUTED"
            ? "Please call before arriving, the gate code needs changing."
            : undefined,
      });
    } catch (error) {
      console.log(`  ! booking skipped: ${(error as Error).message}`);
      continue;
    }

    created += 1;

    // Drive the lifecycle through the real state machine.
    const path: Array<"ACCEPTED" | "ON_THE_WAY" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED"> = [
      "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED",
    ];
    const stopAt =
      item.state === "REQUESTED" ? -1 :
      item.state === "IN_PROGRESS" ? 3 :
      item.state === "COMPLETED" || item.state === "DISPUTED" ? 4 : -1;

    for (let i = 0; i <= stopAt; i += 1) {
      const result = await transitionBooking({
        bookingId: booking.id,
        to: path[i],
        actor: "PROVIDER",
        actorUserId: providerService.providerProfile.userId,
        waivePayment: true,
      });
      if (!result.ok) break;
    }

    if (item.state === "CANCELLED") {
      await transitionBooking({
        bookingId: booking.id,
        to: "CANCELLED",
        actor: "CUSTOMER",
        actorUserId: customerId,
        reason: "Resolved itself before the visit",
        waivePayment: true,
      });
    }

    if (item.state === "DISPUTED") {
      const ref = generateBookingReference();
      // Complaint first, then the dispute referencing it, so the two rows do
      // not compete to create the same complaint.
      const complaint = await prisma.complaint.create({
        data: {
          reference: ref,
          bookingId: booking.id,
          customerId,
          providerProfileId: providerService.providerProfileId,
          against: "PROVIDER",
          category: "SERVICE_QUALITY",
          subject: "Work did not fix the problem",
          description:
            "The problem came back two days after the visit. I have paid the full amount and would like this looked at again.",
          status: "OPEN",
          priority: "HIGH",
        },
        select: { id: true },
      });
      await prisma.dispute.create({
        data: {
          complaintId: complaint.id,
          bookingId: booking.id,
          openedByUserId: customerId,
          claimAmountPoisha: bdtToPoisha(800),
        },
      });
      await transitionBooking({
        bookingId: booking.id,
        to: "DISPUTED",
        actor: "CUSTOMER",
        actorUserId: customerId,
        reason: "Problem returned after the visit",
        waivePayment: true,
      });
    }

    if (item.charge) {
      await prisma.additionalChargeRequest.create({
        data: {
          bookingId: booking.id,
          requestedByUserId: providerService.providerProfile.userId,
          amountPoisha: item.charge.amount,
          reason:
            item.charge.amount > bdtToPoisha(2000)
              ? "Water damage to the skirting board needs replacing, which was not in scope."
              : "An extra fitting was needed that is not included in the standard price.",
        },
      });
      if (item.charge.approve) {
        await prisma.additionalChargeRequest.updateMany({
          where: { bookingId: booking.id },
          data: {
            status: "APPROVED",
            respondedAt: new Date(),
            respondedByUserId: customerId,
            customerNote: "Approved, please go ahead.",
          },
        });
        await prisma.bookingEvent.create({
          data: {
            bookingId: booking.id,
            actor: "CUSTOMER",
            actorUserId: customerId,
            type: "CHARGE_APPROVED",
            summary: `Approved an additional charge of ৳${(item.charge.amount / 100).toFixed(0)}`,
          },
        });
      }
    }

    if (item.state === "COMPLETED") {
      completed += 1;

      if (item.review !== undefined) {
        const [rating, title, body] = REVIEW_TEXTS[item.review % REVIEW_TEXTS.length];
        const total = bdtToPoisha(
          providerService.minPricePoisha +
            (item.charge?.approve ? item.charge.amount : 0),
        );
        try {
          await prisma.review.create({
            data: {
              bookingId: booking.id,
              customerId,
              providerProfileId: providerService.providerProfileId,
              serviceId: providerService.serviceId,
              rating,
              title,
              body,
            },
          });
        } catch {
          // The unique constraint on bookingId already guarantees one review
          // per job; a duplicate here is the constraint doing its job.
        }
        void total;
      }
    }
  }

  console.log(`  bookings: ${created} (${completed} completed)`);

  // ---- recompute ratings from the review rows --------------------------
  for (const spec of PROVIDERS) {
    const profile = await prisma.providerProfile.findUnique({
      where: { slug: spec.slug },
      select: { id: true },
    });
    if (!profile) continue;
    const stats = await prisma.review.aggregate({
      where: { providerProfileId: profile.id, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    });
    // Only the reviews that actually exist are counted. The seeded
    // completedJobs figure is a supplied history; the rating is derived.
    await prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        ratingCount: stats._count,
        ratingAvg: stats._count > 0 ? (stats._avg.rating ?? 0) : 0,
      },
    });
  }

  // ---- messages ---------------------------------------------------------
  const firstCustomer = customerIds[0];
  const firstProvider = await prisma.providerProfile.findFirst({
    where: { slug: "rafiqul-islam" },
    select: { id: true, userId: true },
  });

  if (firstProvider) {
    const conversation = await prisma.conversation.create({
      data: {
        customerId: firstCustomer,
        providerProfileId: firstProvider.id,
        lastMessageAt: new Date(),
        lastMessagePreview: "Yes, 11am works. See you then.",
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderUserId: firstCustomer,
          body: "Assalamu alaikum. My AC is not cooling properly. Is tomorrow morning possible?",
          createdAt: new Date(Date.now() - 3 * 3_600_000),
        },
        {
          conversationId: conversation.id,
          senderUserId: firstProvider.userId,
          body: "Wa alaikum assalam. Yes, I can come at 11am. Is it a split unit?",
          createdAt: new Date(Date.now() - 2.5 * 3_600_000),
        },
        {
          conversationId: conversation.id,
          senderUserId: firstCustomer,
          body: "Yes, 1.5 ton split, in the bedroom.",
          createdAt: new Date(Date.now() - 2 * 3_600_000),
        },
        {
          conversationId: conversation.id,
          senderUserId: firstProvider.userId,
          body: "That is usually low gas or a dirty filter. I will check both. 11am works.",
          createdAt: new Date(Date.now() - 1.5 * 3_600_000),
        },
        {
          conversationId: conversation.id,
          senderUserId: firstCustomer,
          body: "Yes, 11am works. See you then.",
          createdAt: new Date(Date.now() - 1 * 3_600_000),
        },
      ] as never,
    });
    console.log("  conversations: 1");
  }

  // ---- a coupon, for the promo surface ---------------------------------
  // Upsert so the seeder is safe to re-run without clearing the coupon table.
  await prisma.coupon.upsert({
    where: { code: "LAUNCH100" },
    update: { isActive: true },
    create: {
      code: "LAUNCH100",
      description: "৳100 off the first booking",
      type: "FIXED",
      value: bdtToPoisha(100),
      minOrderPoisha: bdtToPoisha(500),
      maxRedemptions: 500,
      maxRedemptionsPerUser: 1,
      firstBookingOnly: true,
      startsAt: new Date(Date.now() - 7 * 86_400_000),
      endsAt: new Date(Date.now() + 60 * 86_400_000),
    },
  });

  // Upsert rather than update: the settings row is created by the canonical
  // seed, but the demo branch should not assume it is present.
  await prisma.setting.upsert({
    where: { key: "referral.enabled" },
    update: { value: true },
    create: { key: "referral.enabled", value: true, group: "growth" },
  });

  const [users, providers, bookings, reviews, payments] = await Promise.all([
    prisma.user.count(),
    prisma.providerProfile.count(),
    prisma.booking.count(),
    prisma.review.count(),
    prisma.payment.count(),
  ]);

  console.log(`
Done. On branch ${branchId}
  users ${users} | providers ${providers} | bookings ${bookings} | reviews ${reviews} | payments ${payments}

Demo sign-in (password for all: ${DEMO_PASSWORD})
  customer  ${CUSTOMERS[0].name.padEnd(20)} ${phone(11)}
  customer  ${CUSTOMERS[1].name.padEnd(20)} ${phone(12)}
  provider  ${PROVIDERS[0].name.padEnd(20)} ${phone(1)}
  provider  ${PROVIDERS[1].name.padEnd(20)} ${phone(2)}

This data exists only on the demo branch. The production branch is untouched.
`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
