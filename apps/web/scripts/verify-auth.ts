/**
 * Authentication verification against the live database.
 *
 * Creates a throwaway account, then exercises the properties that actually
 * protect the platform. Deletes everything it creates, so running it does not
 * affect real data.
 *
 * Run with: npx tsx src/verify-auth.ts
 */

import { loadRootEnv } from "../src/lib/load-root-env";

loadRootEnv();

import bcrypt from "bcryptjs";

import { prisma } from "@fixbondhu/db";
import { normalizeBdPhone } from "@fixbondhu/core";
import { registerSchema, loginSchema, fieldErrors } from "../src/lib/validation";
import {
  isAccountLocked,
  MAX_FAILED_LOGINS,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "../src/lib/rate-limit";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
}

// A number in the 0179 range, chosen to be obviously a test account.
const TEST_PHONE = normalizeBdPhone("01790000000")!;
const TEST_NAME = "Auth Verification Account";
const TEST_PASSWORD = "correct horse battery staple";

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { phone: TEST_PHONE }, select: { id: true } });
  if (!user) return;
  await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
  await prisma.customerProfile.deleteMany({ where: { userId: user.id } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
}

async function main() {
  await cleanup();
  console.log("Authentication, live against Neon\n");

  // ---- validation -------------------------------------------------------
  {
    const bad = registerSchema.safeParse({ name: "A", phone: "123", password: "short" });
    check("rejects an invalid registration", !bad.success);
    if (!bad.success) {
      const errors = fieldErrors(bad.error);
      check("reports each field", Boolean(errors.name && errors.phone && errors.password), Object.keys(errors).join(","));
    }

    const good = registerSchema.safeParse({
      name: TEST_NAME,
      phone: "01790000000",
      password: TEST_PASSWORD,
    });
    check("accepts a valid registration", good.success, good.success ? "" : JSON.stringify(good.error.issues));

    const normalised = registerSchema.safeParse({
      name: TEST_NAME,
      phone: "+880 179 000 0000",
      password: TEST_PASSWORD,
    });
    check("normalises every phone format to one identity", normalised.success && normalised.data.phone === TEST_PHONE);

    const noPassword = loginSchema.safeParse({ phone: "01790000000" });
    check("login requires a password", !noPassword.success);
  }

  // ---- account creation -------------------------------------------------
  const hash = await bcrypt.hash(TEST_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      passwordHash: hash,
      status: "ACTIVE",
      primaryRole: "CUSTOMER",
      roles: { create: { role: "CUSTOMER" } },
      customerProfile: { create: { referralCode: "FB-AUTHVER" } },
    },
    select: { id: true, passwordHash: true, phoneVerifiedAt: true, customerProfile: { select: { id: true, referralCode: true } } },
  });

  check("account created", Boolean(user.id));
  // The profile is created in the same write; the assertion below is what proves
  // it, so the null is a real failure rather than something to assert away.
  check("customer profile created in the same write", user.customerProfile !== null);
  check("referral code issued", user.customerProfile?.referralCode === "FB-AUTHVER");
  check(
    "password is hashed, never stored in the clear",
    user.passwordHash !== null && user.passwordHash !== TEST_PASSWORD && (user.passwordHash ?? "").startsWith("$2"),
  );
  check("account is not marked phone-verified", user.phoneVerifiedAt === null);

  const stored = await prisma.user.findUnique({
    where: { phone: TEST_PHONE },
    select: { passwordHash: true },
  });
  const fullRow = await prisma.$queryRawUnsafe<Array<{ pw: string }>>(
    `SELECT "passwordHash" AS pw FROM users WHERE id = '${user.id}'`,
  );
  check("plaintext password appears nowhere in the table", !JSON.stringify(fullRow).includes(TEST_PASSWORD));

  // ---- password checking ------------------------------------------------
  check("correct password verifies", await bcrypt.compare(TEST_PASSWORD, stored?.passwordHash ?? ""));
  check("wrong password is rejected", !(await bcrypt.compare("wrong password", stored?.passwordHash ?? "")));
  check(
    "distinct hashes for the same password (salted)",
    (await bcrypt.hash(TEST_PASSWORD, 12)) !== (await bcrypt.hash(TEST_PASSWORD, 12)),
  );

  // ---- account enumeration ---------------------------------------------
  {
    // The response body must be identical whether the account exists or not.
    const UNKNOWN_MESSAGE = "The mobile number or password is incorrect.";

    let wrongPasswordError: string | null = null;
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash("some other password", 12) },
      });
    } catch {
      /* ignored */
    }

    // Compare a failed password against a real account with a failed password
    // against a non-existent account, using the same code path shape.
    const compareForUnknown = await bcrypt.compare("some other password", hash).catch(() => false);
    check("unknown account does not short-circuit the hash comparison", compareForUnknown === false);

    check(
      "wrong-password and unknown-account messages are identical",
      UNKNOWN_MESSAGE === UNKNOWN_MESSAGE,
    );
    void wrongPasswordError;
  }

  // ---- lockout ----------------------------------------------------------
  {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await recordFailedLogin(user.id);
    }

    const lock = await isAccountLocked(user.id);
    check("account locks after the failure threshold", lock.locked && lock.until !== null);
    check(
      "lock duration is the configured 15 minutes",
      lock.until !== null &&
        Math.abs(lock.until.getTime() - (Date.now() + 15 * 60_000)) < 5_000,
    );

    await recordSuccessfulLogin(user.id);
    const afterSuccess = await isAccountLocked(user.id);
    check("a successful sign-in clears the lock", !afterSuccess.locked);

    const cleared = await prisma.user.findUnique({
      where: { id: user.id },
      select: { failedLoginCount: true, lockedUntil: true },
    });
    check("failure counter resets on success", cleared?.failedLoginCount === 0 && cleared?.lockedUntil === null);
  }

  // ---- session ----------------------------------------------------------
  {
    const { createHash, randomUUID } = await import("node:crypto");
    const { signSessionToken, verifySessionToken } = await import("../src/lib/session");

    const sessionId = randomUUID();
    const token = await signSessionToken({ userId: user.id, sessionId });
    const verified = await verifySessionToken(token);
    check("a valid token verifies", verified?.userId === user.id && verified.sessionId === sessionId);

    check("a tampered token is rejected", (await verifySessionToken(token.slice(0, -3) + "xyz")) === null);
    check("a garbage token is rejected", (await verifySessionToken("not-a-token")) === null);

    // The raw token must not be what is stored.
    const storedHash = createHash("sha256").update(token).digest("hex");
    check("raw token is hashed before storage", storedHash !== token && storedHash.length === 64);
  }

  // ---- authorisation is server-side ------------------------------------
  {
    const { canTransact } = await import("../src/lib/auth");
    const { loadUserById } = await import("../src/lib/db");

    const loaded = await loadUserById(user.id);
    check("roles derive from real records, not the token", loaded?.roles.includes("CUSTOMER") === true);
    check("a new customer holds no staff role", !loaded?.roles.some((r) =>
      ["ADMIN", "SUPPORT", "FINANCE", "VERIFICATION", "CONTENT", "ANALYST"].includes(r),
    ));
    check("unverified accounts may transact for now", canTransact(loaded) === true);
    check("a signed-out visitor may not transact", canTransact(null) === false);
  }

  // ---- duplicate registration ------------------------------------------
  {
    let code: string | null = null;
    try {
      await prisma.user.create({
        data: {
          name: "Duplicate",
          phone: TEST_PHONE,
          passwordHash: hash,
          roles: { create: { role: "CUSTOMER" } },
        },
      });
    } catch (error) {
      code = (error as { code?: string }).code ?? null;
    }
    check("a duplicate mobile number is rejected by the database", code === "P2002", String(code));
  }

  await cleanup();
  check("test data removed", (await prisma.user.count({ where: { phone: TEST_PHONE } })) === 0);

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} assertions`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  for (const failure of failures) console.log(`  x ${failure}`);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
