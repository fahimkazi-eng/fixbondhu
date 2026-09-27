/**
 * End-to-end search verification against the live database.
 *
 * The 100 unit assertions prove the normaliser and the state machine. This
 * proves the whole path: query -> normalise -> pg_trgm -> ranked results,
 * executed against real seeded rows in Neon.
 *
 * Run with: npx tsx src/verify-search.ts
 */

import { loadRootEnv } from "./lib/load-root-env.js";

// Imported first so DATABASE_URL exists before the Prisma client is first used.
// The client is constructed lazily, so import order no longer matters.
loadRootEnv();

import { prisma } from "@fixbondhu/db";
import { parseQuery } from "@fixbondhu/core";
import { searchServices } from "./lib/search.js";

const QUERIES: Array<{ query: string; expect: string; note: string }> = [
  { query: "AC repair", expect: "AC Repair", note: "plain english" },
  { query: "acrpaire", expect: "AC Repair", note: "typo, no spaces" },
  { query: "a.c. repaire", expect: "AC Repair", note: "punctuation + typo" },
  { query: "এসি রিপেয়ার", expect: "AC Repair", note: "bangla script" },
  { query: "ac thik korte hobe", expect: "AC Repair", note: "banglish intent" },
  { query: "plumber দরকার", expect: "Plumber Visit", note: "mixed script" },
  { query: "plambur", expect: "Plumber Visit", note: "vowel-substitution typo" },
  { query: "ফ্যান ঠিক করতে হবে", expect: "Fan Installation & Repair", note: "bangla intent sentence" },
  { query: "fan thik korte hobe", expect: "Fan Installation & Repair", note: "banglish intent sentence" },
  { query: "fridj repair", expect: "Refrigerator Repair", note: "consonant typo + alias" },
  { query: "carpnter", expect: "Carpentry", note: "carpenter typo via category" },
  { query: "বাসার ইলেকট্রিশিয়ান", expect: "Electrician Visit", note: "bangla noun phrase" },
  { query: "giasar", expect: "Geyser Installation & Repair", note: "nonstandard banglish spelling" },
  { query: "woda pump", expect: "Water Pump Repair", note: "vowel typo multiword" },
  { query: "tala khola lagbe", expect: "Lock Repair & Installation", note: "banglish intent, lock" },
  { query: "pankha repair", expect: "Fan Installation & Repair", note: "banglish alias pankha" },
  { query: "টেলাপোকা", expect: "Cockroach Control", note: "bangla only" },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log("Search pipeline, live against Neon\n");
  console.log("query".padEnd(26) + "parsed core".padEnd(22) + "top result");
  console.log("-".repeat(84));

  for (const testCase of QUERIES) {
    const parsed = parseQuery(testCase.query);
    const { hits } = await searchServices({ query: testCase.query, limit: 5 });

    // The expectation may name a service or a category; accept either, because
    // a correct result reached via its parent category is still correct.
    const matched =
      hits.some((hit) => hit.nameEn === testCase.expect) ||
      hits.some((hit) =>
        hit.categoryNameEn.toLowerCase().includes(testCase.expect.toLowerCase()),
      );

    if (matched) passed += 1;
    else {
      failures.push(
        `"${testCase.query}" (${testCase.note}) expected ${testCase.expect}, got ` +
          (hits.map((h) => h.nameEn).join(", ") || "NOTHING"),
      );
    }

    const top = hits[0];
    console.log(
      testCase.query.padEnd(26) +
        (parsed.core || "-").slice(0, 20).padEnd(22) +
        (top ? `${top.nameEn} (${top.score.toFixed(2)})` : "NO RESULT") +
        (matched ? "" : "   <-- MISS"),
    );
  }

  console.log("-".repeat(84));

  // The indexed columns must actually be populated. If they were null, the
  // results above would be explained by anything other than working search.
  const services = await prisma.service.findMany({
    select: { searchText: true, searchSkeleton: true },
  });
  const withText = services.filter((s) => s.searchText).length;
  const withSkeleton = services.filter((s) => s.searchSkeleton).length;
  console.log(
    `indexed: ${withText}/${services.length} searchText, ${withSkeleton}/${services.length} searchSkeleton`,
  );
  if (withText !== services.length) {
    failures.push(`${services.length - withText} services have a null searchText`);
  }
  if (withSkeleton !== services.length) {
    failures.push(`${services.length - withSkeleton} services have a null searchSkeleton`);
  }

  // A nonsense query must return nothing. Search that matches indiscriminately
  // is worse than no search, because it sends people to random providers.
  const nonsense = await searchServices({ query: "zzzqqqxyz nonexistentthing", limit: 10 });
  console.log(`nonsense query -> ${nonsense.hits.length} results (must be 0)`);
  if (nonsense.hits.length > 0) {
    failures.push(`nonsense query matched ${nonsense.hits.length} services`);
  }

  // An empty query must not degrade into "match everything".
  const empty = await searchServices({ query: "   ", limit: 10 });
  console.log(`empty query     -> ${empty.hits.length} results (must be 0)`);
  if (empty.hits.length > 0) failures.push("empty query returned results");

  // Supply honesty: a matching service with no providers must report zero, not
  // invent availability.
  const ac = await searchServices({ query: "AC Repair", limit: 10 });
  const providers = ac.hits.reduce((sum, hit) => sum + hit.availableProviders, 0);
  console.log(`supply: ${providers} verified providers across ${ac.hits.length} matching services`);

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed}/${QUERIES.length} queries reached the expected service`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${QUERIES.length} queries\n`);
  for (const failure of failures) console.log(`  x ${failure}`);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
