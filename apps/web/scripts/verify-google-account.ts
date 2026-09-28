/**
 * Google sign-in: what happens AFTER the token is verified.
 *
 * verify-google.ts proves a forged token is refused. That leaves the other
 * half of the security story untested: the claims are genuine, so what does the
 * system do with them? This suite exercises that against a real database with
 * real rows, using a throwaway account created and removed by the run.
 *
 * The cases that matter commercially:
 *   - a returning customer who registered with a phone keeps their bookings
 *     when they later sign in with Google (no duplicate, no lost history)
 *   - linking does not wipe an existing password
 *   - a suspended or closed account cannot get in on a valid Google token
 *   - a second sign-in with the same Google account reuses the same user
 *
 * Run: npx tsx scripts/verify-google-account.ts
 */

import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@fixbondhu/db";

import { loadRootEnv } from "../src/lib/load-root-env";
import type { GoogleIdentity } from "../src/lib/auth/google";

loadRootEnv();

// The demo branch, same rule as every other suite that writes rows: refuse to
// fall back to DATABASE_URL, which on a developer machine is production.
const DEMO_URL = process.env.DEMO_DATABASE_URL;
if (!DEMO_URL) {
  throw new Error(
    "DEMO_DATABASE_URL is required. This suite writes users, so it must never\n" +
      "run against the production branch.",
  );
}
const PRODUCTION_BRANCH_ID = "br-orange-bird-az5zc8uz";

/*
 * Point the SHARED client at the demo branch before anything can build it.
 *
 * loadRootEnv uses dotenv with override:false, so a value set here always wins
 * over the .env file. The ordering matters: this has to happen before the first
 * access to `prisma` anywhere, because construction is lazy and caches.
 *
 * An earlier version of this file did NOT do this, and the result was two
 * databases in one process. This script's own client read the demo branch while
 * resolveGoogleAccount, through @/lib/db, read production. Nothing threw; the
 * assertions just failed against rows that were never there, and two test users
 * were written to production. Hence both the assignment and the assertion below.
 */
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
  console.log(`Google account resolution against branch ${branchId}\n`);
  if (branchId === PRODUCTION_BRANCH_ID) {
    throw new Error("Refusing to run: DEMO_DATABASE_URL points at the production branch.");
  }

  // resolveGoogleAccount calls createSession, which needs the auth secret and
  // writes a session row. A placeholder is enough: this is proving which user
  // gets the session, not that the cookie is well formed.
  process.env.AUTH_SECRET ||= "verify-google-account-secret-0123456789abcdefghijklmnopqrs";

  const { resolveGoogleAccount, shouldSignIn } = await import("../src/lib/auth/google-account");

  const stamp = Date.now().toString().slice(-9);
  const email = `ga-${stamp}@example.com`;
  const sub = `google-sub-${stamp}`;

  /** A verified identity. Only the verifier can produce one for real. */
  function identity(over: Partial<GoogleIdentity> = {}): GoogleIdentity {
    return {
      sub,
      email,
      emailVerified: true,
      name: "Google Person",
      picture: null,
      ...over,
    };
  }

  const created: string[] = [];
  const password = "existing-password-123";

  try {
    // ---- case 3: a brand new Google user ---------------------------------
    {
      const r = await resolveGoogleAccount(identity(), null);
      check("a new Google user is created", r.outcome === "created", r.outcome);
      check("a new Google user is signed in", shouldSignIn(r) === true);
      if (shouldSignIn(r)) check("a new Google user is sent to add a phone", r.needsPhone === true);
      created.push(r.userId);

      const user = await prisma.user.findUnique({
        where: { id: r.userId },
        include: {
          customerProfile: true,
          roles: true,
          identities: true,
          auditLogs: { orderBy: { createdAt: "desc" } },
        },
      });

      check("the account has no password", user?.passwordHash === null);
      check("the account gets a customer profile", user?.customerProfile !== null);
      check("the account gets a referral code", Boolean(user?.customerProfile?.referralCode));
      check("a CUSTOMER role row exists", user?.roles.some((x) => x.role === "CUSTOMER") === true);
      check(
        "the Google identity is recorded",
        user?.identities.some((i) => i.provider === "google" && i.providerAccountId === sub) === true,
      );
      // The cookie itself cannot be asserted here: createSession needs Next's
      // request scope, which is why the route issues it rather than the
      // resolver. The audit row records the decision instead.
      check(
        "the account creation is audited",
        user?.auditLogs.some((a) => a.action === "CREATE" && (a.summary ?? "").includes("Google")) === true,
      );
      check("the name comes from Google", user?.name === "Google Person");
    }

    // ---- case 1: the same Google account again ---------------------------
    {
      const r = await resolveGoogleAccount(identity(), null);
      check("a second sign-in reuses the same user", r.userId === created[0], r.userId);
      check("a second sign-in is not a new account", r.outcome === "signed-in", r.outcome);

      const total = await prisma.user.count({ where: { identities: { some: { providerAccountId: sub } } } });
      check("exactly one user owns that Google identity", total === 1, `found ${total}`);

      const audit = await prisma.auditLog.findFirst({
        where: { actorUserId: created[0], action: "LOGIN" },
        orderBy: { createdAt: "desc" },
      });
      check("the returning sign-in is audited as a login", audit !== null);
      check("the audit names Google as the method", (audit?.summary ?? "").includes("Google"));
    }

    // ---- case 2: linking an existing phone-registered account -----------
    {
      // The scenario that matters: a customer who signed up with a phone, made
      // a booking, and later taps "Continue with Google".
      //
      // A distinct email from the one case 3 used, because this account has to
      // exist BEFORE the Google sign-in for the linking path to mean anything.
      const phoneCustomerEmail = `ga-phone-${stamp}@example.com`;
      const phone = `+8801${stamp}`;
      const passwordHash = await bcrypt.hash(password, 10);
      const area = await prisma.location.findFirst({ where: { nameEn: "Banani" } });
      const existing = await prisma.user.create({
        data: {
          name: "Phone Customer",
          phone,
          email: phoneCustomerEmail,
          passwordHash,
          status: "ACTIVE",
          primaryRole: "CUSTOMER",
          roles: { create: { role: "CUSTOMER" } },
          customerProfile: { create: { referralCode: `GA${stamp}` } },
          addresses: {
            create: {
              label: "Home",
              line1: "House 1, Road 1",
              areaName: "Banani",
              districtName: "Dhaka",
              divisionName: "Dhaka",
              locationId: area?.id ?? null,
              latitude: area?.latitude ?? null,
              longitude: area?.longitude ?? null,
              isDefault: true,
            },
          },
        },
        include: { customerProfile: true, addresses: true },
      });
      created.push(existing.id);

      // Give them a real booking worth losing, created through the real service
      // rather than hand-written rows. Booking carries 18 required snapshot
      // fields precisely so history stays readable after a provider is renamed
      // or a price changes, and inventing them here would test nothing real.
      const providerService = await prisma.providerService.findFirst({
        where: { providerProfile: { status: "ACTIVE" } },
        select: { id: true, providerProfileId: true },
      });
      let bookingId: string | null = null;
      if (providerService && area) {
        const { createBooking } = await import("../src/lib/bookings");
        const booking = await createBooking({
          customerId: existing.id,
          providerServiceId: providerService.id,
          addressId: existing.addresses[0]!.id,
          scheduledAt: new Date(Date.now() + 3 * 86_400_000),
          paymentMethod: "CASH",
        });
        bookingId = booking.id;
      }
      check("the existing customer has a booking to lose", bookingId !== null);

      const linkSub = `google-sub-link-${stamp}`;
      const r = await resolveGoogleAccount(
        identity({ sub: linkSub, email: phoneCustomerEmail, name: "Phone Customer" }),
        null,
      );

      check("an existing email is linked, not duplicated", r.outcome === "linked", r.outcome);
      check("the link lands on the original account", r.userId === existing.id);
      if (shouldSignIn(r)) check("a customer with a phone is not asked for one", r.needsPhone === false);

      const after = await prisma.user.findUnique({
        where: { id: existing.id },
        include: { identities: true },
      });
      check("the original password still works after linking", after?.passwordHash === passwordHash);
      check(
        "the Google identity is attached to the original account",
        after?.identities.some((i) => i.providerAccountId === linkSub) === true,
      );
      check("the original name is not overwritten", after?.name === "Phone Customer");

      const nowLinked = await prisma.user.count({ where: { email: phoneCustomerEmail } });
      check("still exactly one account for that email", nowLinked === 1, `found ${nowLinked}`);

      if (bookingId) {
        const stillThere = await prisma.booking.count({ where: { id: bookingId } });
        check("their existing booking survives the sign-in", stillThere === 1);
        const owner = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { customerId: true },
        });
        check("the booking still belongs to the same account", owner?.customerId === existing.id);
      }
    }

    // ---- a suspended account cannot use a valid Google token ------------
    {
      const suspEmail = `ga-susp-${stamp}@example.com`;
      const suspSub = `google-sub-susp-${stamp}`;
      const user = await prisma.user.create({
        data: {
          name: "Suspended Person",
          phone: `+8802${stamp}`,
          email: suspEmail,
          passwordHash: null,
          status: "SUSPENDED",
          primaryRole: "CUSTOMER",
          roles: { create: { role: "CUSTOMER" } },
          customerProfile: { create: { referralCode: `GS${stamp}` } },
        },
      });
      created.push(user.id);

      const r = await resolveGoogleAccount(
        identity({ sub: suspSub, email: suspEmail, name: "Suspended Person" }),
        null,
      );
      check("a suspended account is refused", r.outcome === "suspended", r.outcome);
      // The guarantee is that the route will not issue a session, which is what
      // shouldSignIn decides. A session row cannot be used as evidence here
      // because the resolver never creates one.
      check("a suspended account is never signed in", shouldSignIn(r) === false);
      const sessions = await prisma.session.count({ where: { userId: user.id } });
      check("a suspended account has no session rows", sessions === 0, `found ${sessions}`);

      // And still refused when the identity is already linked.
      await prisma.authIdentity.create({
        data: { userId: user.id, provider: "google", providerAccountId: suspSub, emailAtLink: suspEmail },
      });
      const again = await resolveGoogleAccount(
        identity({ sub: suspSub, email: suspEmail, name: "Suspended Person" }),
        null,
      );
      check("a suspended account stays refused once linked", again.outcome === "suspended", again.outcome);
      check("still never signed in once linked", shouldSignIn(again) === false);
    }

    // ---- a closed account cannot be resurrected by Google ----------------
    {
      const closedEmail = `ga-closed-${stamp}@example.com`;
      const closedSub = `google-sub-closed-${stamp}`;
      const user = await prisma.user.create({
        data: {
          name: "Closed Person",
          phone: `+8803${stamp}`,
          email: closedEmail,
          passwordHash: null,
          status: "ACTIVE",
          deletedAt: new Date(),
          primaryRole: "CUSTOMER",
          roles: { create: { role: "CUSTOMER" } },
          customerProfile: { create: { referralCode: `GC${stamp}` } },
        },
      });
      created.push(user.id);
      await prisma.authIdentity.create({
        data: { userId: user.id, provider: "google", providerAccountId: closedSub, emailAtLink: closedEmail },
      });

      const r = await resolveGoogleAccount(
        identity({ sub: closedSub, email: closedEmail, name: "Closed Person" }),
        null,
      );
      check("a closed account is refused", r.outcome === "deleted", r.outcome);
      check("a closed account is never signed in", shouldSignIn(r) === false);
      const sessions = await prisma.session.count({ where: { userId: user.id } });
      check("a closed account has no session rows", sessions === 0, `found ${sessions}`);
    }

    // ---- two different Google accounts, one email -------------------------
    {
      // Google verifies an email, so this should not happen upstream. If it ever
      // did, the second person must not be able to walk into the first's
      // account, because the unique constraint is on the Google sub and not on
      // the email.
      const sharedEmail = `ga-shared-${stamp}@example.com`;
      const first = await resolveGoogleAccount(
        identity({ sub: `google-sub-a-${stamp}`, email: sharedEmail, name: "First" }),
        null,
      );
      created.push(first.userId);
      check("the first Google account on an email is created", first.outcome === "created", first.outcome);

      // The email now already exists, so the second sub links to it rather than
      // creating a duplicate. That is correct for a genuine owner of one Google
      // account; what must never happen is it creating a *second user*.
      const second = await resolveGoogleAccount(
        identity({ sub: `google-sub-b-${stamp}`, email: sharedEmail, name: "Second" }),
        null,
      );
      check("a second Google sub on the same email does not create a new user",
        second.userId === first.userId, second.userId);
      created.push(second.userId);

      const dupes = await prisma.user.count({ where: { email: sharedEmail } });
      check("one email still means one account", dupes === 1, `found ${dupes}`);
    }

    // ---- the identity is unique at the database level --------------------
    {
      const dupSub = `google-sub-dup-${stamp}`;
      const owner = await prisma.user.findFirst({
        where: { identities: { some: { providerAccountId: sub } } },
        select: { id: true },
      });
      if (owner) {
        let rejected = false;
        try {
          await prisma.authIdentity.create({
            data: { userId: owner.id, provider: "google", providerAccountId: dupSub, emailAtLink: email },
          });
          // same sub, different row -> must violate the unique index
          await prisma.authIdentity.create({
            data: { userId: owner.id, provider: "google", providerAccountId: sub, emailAtLink: email },
          });
        } catch {
          rejected = true;
        }
        check("the database refuses a duplicate Google identity", rejected);
      }
    }
  } finally {
    // ---- clean up everything this run created ---------------------------
    // In dependency order. bookings_customerId_fkey is RESTRICT rather than
    // CASCADE on purpose, so a booking can never quietly disappear because a
    // user row went away; cleanup has to remove the history first.
    const ids = [...created];
    if (ids.length > 0) {
      await prisma.bookingEvent.deleteMany({ where: { booking: { customerId: { in: ids } } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { booking: { customerId: { in: ids } } } });
      await prisma.payment.deleteMany({ where: { booking: { customerId: { in: ids } } } });
      await prisma.review.deleteMany({ where: { booking: { customerId: { in: ids } } } });
      await prisma.booking.deleteMany({ where: { customerId: { in: ids } } });
      await prisma.authIdentity.deleteMany({ where: { userId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.address.deleteMany({ where: { userId: { in: ids } } });
      await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    const leftovers = await prisma.user.count({
      where: {
        OR: [
          { email: { startsWith: `ga-${stamp}` } },
          { email: { startsWith: `ga-phone-${stamp}` } },
          { email: { startsWith: `ga-susp-${stamp}` } },
          { email: { startsWith: `ga-closed-${stamp}` } },
          { email: { startsWith: `ga-shared-${stamp}` } },
          { phone: { in: [`+8801${stamp}`, `+8802${stamp}`, `+8803${stamp}`] } },
        ],
      },
    });
    console.log(`\n  cleaned up; ${leftovers} verification users remain`);
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} Google account resolution assertions`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
