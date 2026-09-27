/**
 * Money.
 *
 * Every monetary value in FixBondhu is an integer count of POISHA
 * (1 BDT = 100 poisha). This is not a stylistic choice: the platform splits a
 * booking between a commission and a provider earning, applies coupons, issues
 * partial refunds and settles payouts. Doing that in floating point produces
 * reconciliation drift of a few poisha per transaction that becomes
 * unrecoverable at payout time. Integers make every split exact.
 */

export const POISHA_PER_BDT = 100;

/** Largest single charge we will ever display, in poisha (BDT 10,000,000). */
export const MAX_AMOUNT_POISHA = 1_000_000_000;

export function bdtToPoisha(bdt: number): number {
  if (!Number.isFinite(bdt)) {
    throw new TypeError(`bdtToPoisha received a non-finite number: ${bdt}`);
  }
  // Round rather than truncate: 12.345 taka is 1235 poisha, not 1234.
  return Math.round(bdt * POISHA_PER_BDT);
}

export function poishaToBdt(poisha: number): number {
  return poisha / POISHA_PER_BDT;
}

export function assertPoisha(value: number, label = "amount"): number {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer number of poisha, got ${value}`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must not be negative, got ${value}`);
  }
  if (value > MAX_AMOUNT_POISHA) {
    throw new RangeError(`${label} exceeds the maximum allowed amount`);
  }
  return value;
}

/**
 * Basis-point percentage, rounded DOWN.
 *
 * The remainder stays with the platform rather than the provider, so a
 * commission can never over-charge a provider by a fraction of a taka. The
 * provider's earning is then derived as the exact remainder:
 *
 *   commission = floor(total * bps / 10_000)
 *   earning    = total - commission      // always sums back exactly
 */
export function applyCommissionBps(totalPoisha: number, bps: number): {
  commissionPoisha: number;
  providerPoisha: number;
} {
  assertPoisha(totalPoisha, "totalPoisha");
  if (!Number.isInteger(bps) || bps < 0) {
    throw new RangeError(`commission bps must be a non-negative integer, got ${bps}`);
  }
  const commissionPoisha = Math.floor((totalPoisha * bps) / 10_000);
  return {
    commissionPoisha,
    providerPoisha: totalPoisha - commissionPoisha,
  };
}

export function addPoisha(...values: number[]): number {
  return values.reduce<number>((sum, value) => sum + assertPoisha(value), 0);
}

export function subtractPoisha(minuend: number, subtrahend: number): number {
  return assertPoisha(
    assertPoisha(minuend, "minuend") - assertPoisha(subtrahend, "subtrahend"),
  );
}

const BDT_GROUPED = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * BDT is written "৳1,200" not "BDT 1,200.00" — the taka sign is universally
 * understood in Bangladesh and the decimals are noise at reading speed.
 * Zero decimals unless the amount genuinely has poisha, because a service price
 * of ৳500.00 should not render as ৳500.00.
 */
export function formatPoisha(poisha: number, options?: { locale?: "bn" | "en" }): string {
  const bdt = poishaToBdt(poisha);
  if (bdt === 0) return "৳0";
  const hasPoisha = Math.abs(bdt) < 1 || !Number.isInteger(bdt);
  if (hasPoisha) {
    return bdt < 0
      ? `-৳${Math.abs(bdt).toFixed(2)}`
      : `৳${bdt.toFixed(2)}`;
  }
  const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.abs(Math.trunc(bdt)),
  );
  return bdt < 0 ? `-৳${grouped}` : `৳${grouped}`;
}

/** Renders a price band. Identical endpoints collapse to a single figure. */
export function formatPoishaRange(
  minPoisha: number,
  maxPoisha: number,
  options?: { locale?: "bn" | "en" },
): string {
  if (minPoisha === maxPoisha) return formatPoisha(minPoisha, options);
  return `${formatPoisha(minPoisha, options)} – ${formatPoisha(maxPoisha, options)}`;
}

/** Parses user input ("1,200", "1200.50", "৳1200") to poisha. Null if unusable. */
export function parseBdtToPoisha(input: string): number | null {
  const cleaned = input
    .replace(/[৳Tk,]/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return bdtToPoisha(value);
}

export { BDT_GROUPED };
