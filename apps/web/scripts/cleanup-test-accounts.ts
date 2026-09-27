/**
 * Removes accounts created by the verification scripts.
 *
 * The live check registers a real account because that is the only honest way
 * to test registration, so this cleans up after it. Run after verify-live.
 *
 *   npx tsx scripts/cleanup-test-accounts.ts
 */

import { loadRootEnv } from "../src/lib/load-root-env";

loadRootEnv();

import { prisma } from "@fixbondhu/db";

/**
 * Only accounts created by the verification scripts match: the reserved test
 * names below. Anything else is left alone, so running this against a database
 * with real users is safe.
 */
const TEST_NAME_PREFIXES = ["Production Test", "Browser Test User"];

async function main() {
  // Matched on the names the checks use, not a number prefix: the tests
  // generate random 11-digit numbers, so the operator prefix is not stable.
  const users = await prisma.user.findMany({
    where: {
      OR: TEST_NAME_PREFIXES.map((prefix) => ({ name: { startsWith: prefix } })),
    },
    select: { id: true, phone: true, name: true },
  });

  if (users.length === 0) {
    console.log("No verification accounts found.");
    return;
  }

  for (const user of users) {
    // Children first, mirroring the cascade order, so this works even if a
    // future change loosens a foreign key.
    await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
    await prisma.customerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    console.log(`removed ${user.phone} (${user.name})`);
  }

  console.log(`\nRemoved ${users.length} verification account(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
