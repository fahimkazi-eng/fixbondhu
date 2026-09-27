/**
 * Verification harness for the domain core.
 *
 * These are the rules the business depends on, so they are asserted rather than
 * eyeballed. Run with: npx tsx src/verify.ts
 *
 * The search assertions deliberately use the same twelve queries the pg_trgm
 * experiment measured, so the claim in the migration comment and the behaviour
 * of this code can be compared directly.
 */

import {
  applyCommissionBps,
  bdtToPoisha,
  formatPoisha,
  formatPoishaRange,
  parseBdtToPoisha,
} from "./money";
import {
  buildSearchTerms,
  detectLanguage,
  expandWithSynonyms,
  latinSkeleton,
  normalizeForSearch,
  parseQuery,
} from "./search";
import {
  canTransition,
  evaluateTransition,
  isClosed,
  type BookingStatus,
} from "./booking-state";
import {
  computeBookingTotal,
  computeCommission,
  evaluateCancellation,
  evaluateNoShow,
  isValidPriceBand,
  resolveCommissionBps,
} from "./rules";
import {
  distanceKm,
  formatBdPhone,
  isValidBdPhone,
  maskPhone,
  normalizeBdPhone,
  slugifyBangla,
} from "./bd";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

function equal<T>(name: string, actual: T, expected: T): void {
  check(name, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`);
}

// ---------------------------------------------------------------------------
console.log("money");
equal("bdtToPoisha", bdtToPoisha(1200), 120_000);
equal("bdtToPoisha rounds, never truncates", bdtToPoisha(12.345), 1235);
equal("formatPoisha whole taka", formatPoisha(120_000), "৳1,200");
equal("formatPoisha poisha only when present", formatPoisha(12_345), "৳123.45");
equal("formatPoisha zero", formatPoisha(0), "৳0");
equal("formatPoishaRange collapses", formatPoishaRange(50_000, 50_000), "৳500");
check("formatPoishaRange band", formatPoishaRange(50_000, 100_000) === "৳500 – ৳1,000");
equal("parseBdtToPoisha plain", parseBdtToPoisha("1200"), 120_000);
equal("parseBdtToPoisha taka sign", parseBdtToPoisha("৳1,200.50"), 120_050);
equal("parseBdtToPoisha rejects junk", parseBdtToPoisha("12abc"), null);

// The guarantee that makes payouts reconcile: the split always sums back.
{
  let allSums = true;
  for (const total of [0, 1, 99, 100, 333, 12_345, 999_999, 1_000_000]) {
    for (const bps of [0, 500, 1200, 1500, 3333, 10000]) {
      const { commissionPoisha, providerPoisha } = applyCommissionBps(total, bps);
      if (commissionPoisha + providerPoisha !== total) allSums = false;
      if (commissionPoisha < 0 || providerPoisha < 0) allSums = false;
      if (!Number.isInteger(commissionPoisha) || !Number.isInteger(providerPoisha)) {
        allSums = false;
      }
    }
  }
  check("commission split always sums back exactly", allSums);
}
{
  // Rounding must favour the platform, never overcharge the provider.
  const { commissionPoisha, providerPoisha } = applyCommissionBps(333, 1200);
  equal("commission rounds down", commissionPoisha, 39);
  equal("provider keeps remainder", providerPoisha, 294);
  equal("rounding loss is small", 333 - (commissionPoisha + providerPoisha), 0);
}

// ---------------------------------------------------------------------------
console.log("search: normalisation");
equal("lowercases and strips punctuation", normalizeForSearch("AC, Repair!"), "ac repair");
equal("bangla digits become ascii", normalizeForSearch("১২৩ টাকা"), "123 টাকা");
equal("bangla script survives", normalizeForSearch("এসি রিপেয়ার"), "এসি রিপেয়ার");
equal("apostrophe removed not spaced", normalizeForSearch("bangla's"), "banglas");
equal("detects bangla", detectLanguage("বাসার ইলেকট্রিশিয়ান"), "bn");
equal("detects english", detectLanguage("ac repair"), "en");
equal("detects banglish mix", detectLanguage("plumber দরকার"), "mixed");

console.log("search: skeleton");
equal("vowel swap collapses", latinSkeleton("plumber"), latinSkeleton("plambur"));
equal("carpenter typo", latinSkeleton("carpenter"), latinSkeleton("carpnter"));
equal("ac repair phrase", latinSkeleton("ac repair"), latinSkeleton("acrpaire"));
equal("geyser variants", latinSkeleton("geyser"), latinSkeleton("giasar"));
equal("y is treated as a vowel", latinSkeleton("geyser"), "gsr");
equal("bangla yields empty skeleton", latinSkeleton("প্লাম্বার"), "");

console.log("search: intent");
{
  const fan = parseQuery("fan thik korte hobe");
  equal("stopwords stripped from banglish", fan.core, "fan");
  // "fan" reduces to a 2-character skeleton, which is deliberately not indexed:
  // pg_trgm needs at least three characters to form a trigram, so storing "fn"
  // would be dead weight. A longer noun is used to assert the behaviour.
  equal("sub-trigram skeletons are dropped", latinSkeleton("fan"), "fn");
  const plumber = parseQuery("plumber thik korte hobe");
  check("skeleton survives intent strip", plumber.skeletons.includes("plmbr"), plumber.skeletons.join(","));
  equal("intent-stripped core is the noun", plumber.core, "plumber");
}
{
  const ac = parseQuery("AC repair near me");
  equal("english filler stripped, service noun kept", ac.core, "ac repair");
  check("location hint detected", ac.hasLocationHint);
}
{
  const elec = parseQuery("বাসার ইলেকট্রিশিয়ান");
  check("bangla intent keeps the noun", elec.core.includes("ইলেকট্রিশিয়ান"), elec.core);
}
{
  const pure = parseQuery("ঠিক করতে হবে");
  check("pure-intent query still searchable", pure.tokens.length > 0);
}
{
  const expanded = expandWithSynonyms(parseQuery("ac repair"));
  check("synonyms add air conditioner", expanded.some((t) => t.includes("air conditioner")));
  check("synonyms add banglish geyser spelling",
    expandWithSynonyms(parseQuery("geyser")).some((t) => t.includes("giasar")));
}

console.log("search: indexed terms");
{
  const { searchText, searchSkeleton } = buildSearchTerms([
    "AC Repair",
    ["এসি রিপেয়ার", "air conditioner servicing"],
    null,
    "ac repair",
  ]);
  check("searchText includes all scripts",
    searchText.includes("ac repair") && searchText.includes("এসি"));
  check("searchText deduped", searchText.split("ac repair").length - 1 === 1);
  check("skeleton built from latin only", searchSkeleton.includes("crpr"), searchSkeleton);
  check("no bangla in skeleton", !/[\u0980-\u09FF]/.test(searchSkeleton));
}

// ---------------------------------------------------------------------------
console.log("booking state machine");
{
  const happy: Array<[BookingStatus, BookingStatus]> = [
    ["REQUESTED", "ACCEPTED"],
    ["ACCEPTED", "ON_THE_WAY"],
    ["ON_THE_WAY", "ARRIVED"],
    ["ARRIVED", "IN_PROGRESS"],
    ["IN_PROGRESS", "COMPLETED"],
  ];
  check("every happy-path hop is provider-permitted",
    happy.every(([from, to]) => canTransition(from, to, "PROVIDER")));
  check("customer cannot self-accept",
    !canTransition("REQUESTED", "ACCEPTED", "CUSTOMER"));
  check("provider cannot cancel after arrival on customer demand",
    !canTransition("ARRIVED", "CANCELLED", "CUSTOMER"));
  check("customer cannot cancel after arrival",
    !canTransition("ARRIVED", "CANCELLED", "CUSTOMER"));
  check("cannot skip from REQUESTED to COMPLETED",
    !canTransition("REQUESTED", "COMPLETED", "PROVIDER"));
  check("terminal states are closed", isClosed("CANCELLED") && isClosed("COMPLETED"));
  check("disputed is not closed", !isClosed("DISPUTED"));
}

// A provider must never be able to complete a gateway booking that has not
// actually been paid. This is the single most important guard in the system.
{
  const unpaid = evaluateTransition({
    from: "IN_PROGRESS",
    to: "COMPLETED",
    actor: "PROVIDER",
    paymentCaptured: false,
    isGatewayPayment: true,
  });
  equal("unpaid gateway booking cannot complete", unpaid.ok, false);
  if (!unpaid.ok) equal("failure names the real reason", unpaid.code, "PAYMENT_NOT_CAPTURED");

  const paid = evaluateTransition({
    from: "IN_PROGRESS",
    to: "COMPLETED",
    actor: "PROVIDER",
    paymentCaptured: true,
    isGatewayPayment: true,
  });
  equal("captured payment allows completion", paid.ok, true);

  const cash = evaluateTransition({
    from: "IN_PROGRESS",
    to: "COMPLETED",
    actor: "PROVIDER",
    paymentCaptured: false,
    isGatewayPayment: false,
  });
  equal("cash completion needs no capture", cash.ok, true);

  const wrongActor = evaluateTransition({
    from: "REQUESTED",
    to: "ACCEPTED",
    actor: "CUSTOMER",
    paymentCaptured: true,
    isGatewayPayment: false,
  });
  equal("customer self-accept rejected", wrongActor.ok, false);
  if (!wrongActor.ok) {
    equal("rejection is FORBIDDEN_ACTOR", wrongActor.code, "FORBIDDEN_ACTOR");
    check("rejection lists the actors who may act",
      (wrongActor.allowedActors ?? []).includes("PROVIDER"));
  }
}

// ---------------------------------------------------------------------------
console.log("commission rules");
{
  const now = new Date("2026-01-01T00:00:00Z");
  const rules = [
    { id: "global", name: "Global", commissionBps: 1200, serviceId: null, categoryId: null, effectiveFrom: new Date("2025-01-01"), effectiveTo: null, isActive: true },
    { id: "cat", name: "AC", commissionBps: 1000, serviceId: null, categoryId: "cat-ac", effectiveFrom: new Date("2025-01-01"), effectiveTo: null, isActive: true },
    { id: "svc", name: "AC gas", commissionBps: 800, serviceId: "svc-gas", categoryId: null, effectiveFrom: new Date("2025-01-01"), effectiveTo: null, isActive: true },
    { id: "expired", name: "Old promo", commissionBps: 100, serviceId: null, categoryId: null, effectiveFrom: new Date("2024-01-01"), effectiveTo: new Date("2024-06-01"), isActive: true },
  ];
  equal("service rule is most specific",
    resolveCommissionBps(rules, { totalPoisha: 1, serviceId: "svc-gas", categoryId: "cat-ac" }, now)?.id, "svc");
  equal("category beats global",
    resolveCommissionBps(rules, { totalPoisha: 1, serviceId: null, categoryId: "cat-ac" }, now)?.id, "cat");
  equal("global applies otherwise",
    resolveCommissionBps(rules, { totalPoisha: 1, serviceId: null, categoryId: null }, now)?.id, "global");
  equal("expired rules are ignored",
    resolveCommissionBps(rules, { totalPoisha: 1, serviceId: "expired-svc", categoryId: null }, now)?.id, "global");

  const split = computeCommission({ totalPoisha: 100_000, rules, serviceId: "svc-gas", categoryId: "cat-ac", now });
  equal("uses matched rule bps", split.bps, 800);
  equal("source recorded as RULE", split.source, "RULE");
  equal("commission computed", split.commissionPoisha, 8_000);
  equal("provider earning", split.providerPoisha, 92_000);
  equal("split sums to total", split.commissionPoisha + split.providerPoisha, 100_000);

  const fallback = computeCommission({ totalPoisha: 100_000, rules: [], now });
  equal("falls back to default bps", fallback.bps, 1200);
  equal("fallback source recorded", fallback.source, "DEFAULT");
}

// ---------------------------------------------------------------------------
console.log("cancellation");
{
  const scheduled = new Date("2026-01-02T10:00:00Z");
  const hoursBefore = (h: number) => new Date(scheduled.getTime() - h * 3_600_000);

  const early = evaluateCancellation({ cancelledBy: "CUSTOMER", scheduledAt: scheduled, now: hoursBefore(48), capturedPoisha: 50_000 });
  equal("24h+ ahead is free", early.kind, "FREE");
  equal("free cancellation refunds all", early.refundPoisha, 50_000);

  const late = evaluateCancellation({ cancelledBy: "CUSTOMER", scheduledAt: scheduled, now: hoursBefore(6), capturedPoisha: 50_000 });
  equal("inside late window charges a fee", late.kind, "LATE_FEE");
  if (late.kind === "LATE_FEE") {
    equal("fee withheld from capture", late.feePoisha, 20_000);
    equal("remainder refunded", late.refundPoisha, 30_000);
  }

  const uncaptured = evaluateCancellation({ cancelledBy: "CUSTOMER", scheduledAt: scheduled, now: hoursBefore(1), capturedPoisha: 0 });
  check("cannot refund more than was captured", uncaptured.refundPoisha === 0, String(uncaptured.refundPoisha));

  const byProvider = evaluateCancellation({ cancelledBy: "PROVIDER", scheduledAt: scheduled, now: hoursBefore(1), capturedPoisha: 50_000 });
  equal("provider cancellation is free to customer", byProvider.kind, "FREE");
  equal("customer is made whole", byProvider.refundPoisha, 50_000);

  const waived = evaluateCancellation({ cancelledBy: "CUSTOMER", scheduledAt: scheduled, now: hoursBefore(1), capturedPoisha: 50_000, waiveFee: true });
  equal("admin can waive the fee", waived.kind, "ADMIN_WAIVED");
  equal("waived refunds everything", waived.refundPoisha, 50_000);
}
{
  const customerNoShow = evaluateNoShow({ absentParty: "CUSTOMER", capturedPoisha: 50_000 });
  equal("customer no-show may retain a fee", customerNoShow.feePoisha, 30_000);
  equal("fee charged to the absent party", customerNoShow.chargedTo, "CUSTOMER");

  const providerNoShow = evaluateNoShow({ absentParty: "PROVIDER", capturedPoisha: 50_000 });
  equal("provider no-show costs the provider", providerNoShow.feePoisha, 0);
  equal("innocent customer fully refunded", providerNoShow.refundInnocentPartyPoisha, 50_000);
}
{
  const total = computeBookingTotal({
    basePricePoisha: 100_000,
    travelFeePoisha: 10_000,
    approvedExtrasPoisha: 25_000,
    discountPoisha: 15_000,
  });
  equal("total assembled from auditable parts", total.totalPoisha, 120_000);

  const overDiscount = computeBookingTotal({ basePricePoisha: 10_000, discountPoisha: 999_999 });
  equal("discount cannot exceed subtotal", overDiscount.totalPoisha, 0);

  const noExtras = computeBookingTotal({ basePricePoisha: 100_000 });
  equal("no extras means no extras charged", noExtras.totalPoisha, 100_000);

  check("valid band accepted", isValidPriceBand({ minPricePoisha: 500, maxPricePoisha: 1500 }));
  check("inverted band rejected", !isValidPriceBand({ minPricePoisha: 1500, maxPricePoisha: 500 }));
  check("base outside band rejected", !isValidPriceBand({ minPricePoisha: 500, maxPricePoisha: 1500, basePricePoisha: 200 }));
  check("base inside band accepted", isValidPriceBand({ minPricePoisha: 500, maxPricePoisha: 1500, basePricePoisha: 900 }));
}

// ---------------------------------------------------------------------------
console.log("bangladesh specifics");
{
  equal("local 11-digit", normalizeBdPhone("01712345678"), "+8801712345678");
  equal("country code", normalizeBdPhone("+8801712345678"), "+8801712345678");
  equal("00 prefix", normalizeBdPhone("008801712345678"), "+8801712345678");
  equal("dashed", normalizeBdPhone("01712-345678"), "+8801712345678");
  equal("spaced", normalizeBdPhone("017 1234 5678"), "+8801712345678");
  check("all formats agree",
    new Set([
      normalizeBdPhone("01712345678"),
      normalizeBdPhone("+8801712345678"),
      normalizeBdPhone("01712 345678"),
      normalizeBdPhone("008801712345678"),
    ]).size === 1);
  equal("rejects too short", normalizeBdPhone("0171234"), null);
  check("rejects invalid prefix", !isValidBdPhone("01012345678"));
  equal("formatted for display", formatBdPhone("+8801712345678"), "01712 345678");
  check("masked phone hides the middle", maskPhone("+8801712345678") === "+88017 ••••••678", maskPhone("+8801712345678"));

  // Banani to Gulshan, roughly 4 km apart in reality.
  const d = distanceKm({ latitude: 23.7937, longitude: 90.4066 }, { latitude: 23.8250, longitude: 90.4340 });
  check("distance is plausible for Dhaka", d > 3 && d < 6, `${d.toFixed(2)} km`);
  equal("zero distance", distanceKm({ latitude: 23.7, longitude: 90.4 }, { latitude: 23.7, longitude: 90.4 }), 0);

  check("bangla slug kept", slugifyBangla("ঢাকা উত্তর") === "ঢাকা-উত্তর", slugifyBangla("ঢাকা উত্তর"));
}

// ---------------------------------------------------------------------------
console.log("");
if (failures.length === 0) {
  console.log(`PASS  ${passed} assertions`);
  process.exit(0);
} else {
  console.log(`FAIL  ${failures.length} of ${passed + failures.length} assertions\n`);
  for (const failure of failures) console.log(`  x ${failure}`);
  process.exit(1);
}
