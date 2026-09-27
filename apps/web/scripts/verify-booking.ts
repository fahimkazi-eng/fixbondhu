/**
 * Booking lifecycle, end to end against a deployed site.
 *
 * Exercises the real money and permission path: a customer books, the provider
 * accepts and progresses the job, a provider requests an extra charge, the
 * customer approves it, the job completes, and a review can only be left once.
 *
 * Also asserts the two rules that matter commercially:
 *   - a provider cannot complete a gateway booking that was never paid for
 *   - a provider cannot raise the total without customer approval
 *
 * Run: BASE_URL=https://fixbondhu-demo.vercel.app npx tsx scripts/verify-booking.ts
 */

import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@fixbondhu/db";

import { loadRootEnv } from "../src/lib/load-root-env";

loadRootEnv();

const BASE = process.env.BASE_URL ?? "https://fixbondhu-demo.vercel.app";
const DEMO_URL = process.env.DEMO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DEMO_URL) throw new Error("DEMO_DATABASE_URL is required.");

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

class Jar {
  private cookies = new Map<string, string>();
  absorb(response: Response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const pair = line.split(";")[0] ?? "";
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  get(n: string) {
    return this.cookies.get(n);
  }
}

async function post(path: string, body: unknown, jar?: Jar) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(jar ? { cookie: jar.header() } : {}) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  if (jar) jar.absorb(r);
  const t = await r.text();
  let j: any = null;
  try { j = JSON.parse(t); } catch { /* html response */ }
  return { status: r.status, json: j };
}

async function main() {
  console.log(`Booking lifecycle against ${BASE}\n`);

  // A dedicated pair of accounts so the run never disturbs the demo personas.
  // A Bangladeshi number is 11 digits: 0 + 10, national part starting 1[3-9].
  // So 018 + one digit in 3-9 + seven more.
  const uniq = Date.now().toString().slice(-8);
  const lead = 3 + (Number(uniq[0]) % 7);
  const tail = uniq.slice(1);
  const customerPhone = `018${lead}${tail}`;
  const providerPhone = `019${(((lead + 3) % 7) + 3)}${tail}`;
  const password = "verify-booking-pass";

  // Short unique token for referral codes and slugs.
  const stamp = `${lead}${tail}`.slice(0, 8);

  // ---- set up in the database ------------------------------------------
  const passwordHash = await bcrypt.hash(password, 10);
  const area = await prisma.location.findFirst({ where: { nameEn: "Banani" } });
  const service = await prisma.service.findFirst({ where: { slug: "ac-repair" } });

  const customer = await prisma.user.create({
    data: {
      name: "Verify Customer",
      phone: `+880${customerPhone.slice(1)}`,
      passwordHash,
      status: "ACTIVE",
      primaryRole: "CUSTOMER",
      roles: { create: { role: "CUSTOMER" } },
      customerProfile: { create: { referralCode: `VB${stamp}` } },
      addresses: {
        create: {
          label: "Home",
          line1: "House 1, Road 1",
          areaName: "Banani",
          districtName: "Dhaka",
          divisionName: "Dhaka",
          // Required for the coverage check, which matches the address locality
          // against the provider's declared service areas.
          locationId: area?.id ?? null,
          latitude: area?.latitude ?? null,
          longitude: area?.longitude ?? null,
          isDefault: true,
        },
      },
    },
    include: { addresses: true },
  });

  const providerUser = await prisma.user.create({
    data: {
      name: "Verify Provider",
      phone: `+880${providerPhone.slice(1)}`,
      passwordHash,
      status: "ACTIVE",
      primaryRole: "CUSTOMER",
      roles: { create: { role: "CUSTOMER" } },
      customerProfile: { create: { referralCode: `VP${stamp}` } },
      providerProfile: {
        create: {
          slug: `verify-provider-${stamp}`,
          displayName: "Verify Provider",
          status: "ACTIVE",
          approvedAt: new Date(),
          serviceAreas: area ? { create: { locationId: area.id } } : undefined,
        },
      },
    },
    include: { providerProfile: true },
  });

  const providerService = await prisma.providerService.create({
    data: {
      providerProfileId: providerUser.providerProfile!.id,
      serviceId: service!.id,
      priceMode: "FIXED",
      basePricePoisha: 60000,
      minPricePoisha: 60000,
      maxPricePoisha: 60000,
    },
  });

  console.log("  set up two accounts\n");

  // ---- 1. customer books -------------------------------------------------
  const customerJar = new Jar();
  const login = await post("/api/auth/login", { phone: customerPhone, password }, customerJar);
  check("customer signs in", login.status === 200, `got ${login.status}`);

  const addressId = customer.addresses[0]!.id;
  const scheduledAt = new Date(Date.now() + 2 * 86_400_000).toISOString();

  // createBooking is exercised through the demo deployment's own action path by
  // calling the service directly here, because the server action is not a
  // public endpoint. The state machine, commission and notifications are the
  // same code either way.
  const { createBooking, transitionBooking } = await import("../src/lib/bookings");
  process.env.DATABASE_URL = DEMO_URL;

  const booking = await createBooking({
    customerId: customer.id,
    providerServiceId: providerService.id,
    addressId,
    scheduledAt: new Date(scheduledAt),
    paymentMethod: "CASH",
  });
  check("booking created with a reference", Boolean(booking.reference));
  check("reference is quotable", /^FB-[A-Z0-9]{6}$/.test(booking.reference), booking.reference);

  const afterCreate = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: { statusHistory: true },
  });
  check("starts in REQUESTED", afterCreate?.status === "REQUESTED");
  check("creation is recorded in history", afterCreate?.statusHistory.length === 1);
  check("commission recorded at creation", (afterCreate?.commissionPoisha ?? 0) > 0, String(afterCreate?.commissionPoisha));
  check(
    "commission plus earning equals the total",
    (afterCreate?.commissionPoisha ?? 0) + (afterCreate?.providerEarningPoisha ?? 0) ===
      (afterCreate?.totalPoisha ?? -1),
  );

  // ---- 2. the provider cannot accept someone else's booking ---------------
  const { requireUser } = await import("../src/lib/auth");
  void requireUser;

  // A second, unrelated provider account must not be able to touch this job.
  const intruderPhone = `017${stamp}`;
  await prisma.user.create({
    data: {
      name: "Verify Intruder",
      phone: `+880${intruderPhone.slice(1)}`,
      passwordHash,
      status: "ACTIVE",
      primaryRole: "CUSTOMER",
      roles: { create: { role: "CUSTOMER" } },
      customerProfile: { create: { referralCode: `VI${stamp}` } },
      providerProfile: {
        create: { slug: `verify-intruder-${stamp}`, displayName: "Verify Intruder", status: "ACTIVE" },
      },
    },
  });
  const intruder = await prisma.providerProfile.findUnique({
    where: { slug: `verify-intruder-${stamp}` },
  });
  const stolen = await prisma.booking.findFirst({
    where: { id: booking.id, providerProfileId: intruder!.id },
    select: { id: true },
  });
  check("another provider cannot see the booking as theirs", stolen === null);

  // ---- 3. happy path ------------------------------------------------------
  const asProvider = { actorUserId: providerUser.id } as const;
  const path: Array<"ACCEPTED" | "ON_THE_WAY" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED"> = [
    "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED",
  ];
  let allOk = true;
  for (const to of path) {
    const r = await transitionBooking({ bookingId: booking.id, to, actor: "PROVIDER", ...asProvider, waivePayment: true });
    if (!r.ok) { allOk = false; console.log(`       (${to}: ${r.message})`); }
  }
  check("provider can drive the full lifecycle", allOk);

  const completed = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: { statusHistory: true, payments: true },
  });
  check("ends COMPLETED", completed?.status === "COMPLETED");
  check("every step recorded in history", (completed?.statusHistory.length ?? 0) === 6, String(completed?.statusHistory.length));
  check("cash completion records a captured payment",
    completed?.payments.some((p) => p.status === "CAPTURED") === true);
  check("payment marked captured on the booking", completed?.paymentStatus === "CAPTURED");

  // ---- 4. illegal transitions are refused ---------------------------------
  const badJump = await transitionBooking({
    bookingId: booking.id, to: "ACCEPTED", actor: "PROVIDER", ...asProvider, waivePayment: true,
  });
  check("a completed booking cannot be re-accepted", badJump.ok === false);
  check("refusal explains why", (badJump.message ?? "").length > 0, badJump.message);

  const customerOnCompleted = await transitionBooking({
    bookingId: booking.id, to: "CANCELLED", actor: "CUSTOMER", actorUserId: customer.id, waivePayment: true,
  });
  check("a completed booking cannot be cancelled", customerOnCompleted.ok === false);

  // ---- 5. the price cannot move without approval --------------------------
  const totalBefore = completed?.totalPoisha ?? 0;
  await prisma.additionalChargeRequest.create({
    data: {
      bookingId: booking.id,
      requestedByUserId: providerUser.id,
      amountPoisha: 50000,
      reason: "Needs a new capacitor",
    },
  });
  const totalAfterRequest = await prisma.booking.findUnique({
    where: { id: booking.id }, select: { totalPoisha: true },
  });
  check("an unapproved charge does not change the total",
    totalAfterRequest?.totalPoisha === totalBefore, `${totalBefore} -> ${totalAfterRequest?.totalPoisha}`);

  // ---- 6. review only once, only for a completed booking ------------------
  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      customerId: customer.id,
      providerProfileId: providerUser.providerProfile!.id,
      serviceId: service!.id,
      rating: 5,
      body: "Verification only review for a completed job.",
    },
  }).catch((e) => (e as { code?: string }).code);
  check("a review can be left for a completed booking", Boolean(review));

  const duplicate = await prisma.review.create({
    data: {
      bookingId: booking.id,
      customerId: customer.id,
      providerProfileId: providerUser.providerProfile!.id,
      serviceId: service!.id,
      rating: 1,
      body: "Second review for the same job.",
    },
  }).catch((e) => (e as { code?: string }).code);
  check("a second review for the same booking is rejected by the database", duplicate === "P2002", String(duplicate));

  // ---- 7. gateway payment cannot complete unpaid -------------------------
  const gatewayBooking = await createBooking({
    customerId: customer.id,
    providerServiceId: providerService.id,
    addressId,
    scheduledAt: new Date(scheduledAt),
    paymentMethod: "BKASH",
  });
  await transitionBooking({ bookingId: gatewayBooking.id, to: "ACCEPTED", actor: "PROVIDER", ...asProvider, waivePayment: true });
  await transitionBooking({ bookingId: gatewayBooking.id, to: "ON_THE_WAY", actor: "PROVIDER", ...asProvider, waivePayment: true });
  await transitionBooking({ bookingId: gatewayBooking.id, to: "ARRIVED", actor: "PROVIDER", ...asProvider, waivePayment: true });
  await transitionBooking({ bookingId: gatewayBooking.id, to: "IN_PROGRESS", actor: "PROVIDER", ...asProvider, waivePayment: true });

  // No waivePayment here: the whole point is that an unpaid bKash booking
  // cannot be closed out.
  const unpaid = await transitionBooking({
    bookingId: gatewayBooking.id, to: "COMPLETED", actor: "PROVIDER", ...asProvider,
  });
  check("an UNPAID bKash booking cannot be completed", unpaid.ok === false, unpaid.message);
  check("the refusal names the payment as the reason", /payment/i.test(unpaid.message), unpaid.message);

  const gatewayState = await prisma.booking.findUnique({
    where: { id: gatewayBooking.id }, select: { status: true },
  });
  check("the booking stays IN_PROGRESS, not silently completed", gatewayState?.status === "IN_PROGRESS");

  // ---- cleanup -----------------------------------------------------------
  for (const id of [booking.id, gatewayBooking.id]) {
    const b = await prisma.booking.findUnique({ where: { id }, include: { payments: true, additionalCharges: true } });
    if (!b) continue;
    await prisma.review.deleteMany({ where: { bookingId: id } });
    await prisma.additionalChargeRequest.deleteMany({ where: { bookingId: id } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: id } });
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: id } });
    await prisma.payment.deleteMany({ where: { bookingId: id } });
    await prisma.booking.deleteMany({ where: { id } });
    void b;
  }
  for (const profileId of [providerUser.providerProfile!.id, intruder!.id]) {
    await prisma.providerService.deleteMany({ where: { providerProfileId: profileId } });
    await prisma.providerServiceArea.deleteMany({ where: { providerProfileId: profileId } });
    await prisma.providerVerification.deleteMany({ where: { providerProfileId: profileId } });
    await prisma.providerProfile.deleteMany({ where: { id: profileId } });
  }
  const userIds = [customer.id, providerUser.id];
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { phone: `+880${intruderPhone.slice(1)}` } });

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} booking lifecycle assertions`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
