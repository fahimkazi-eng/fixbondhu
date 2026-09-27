/**
 * Commission, cancellation and no-show rules.
 *
 * All of it is expressed as data with defaults, because these are commercial
 * terms that change as the business learns, and they must be adjustable from
 * the admin panel without a deploy. The functions here take the resolved rules
 * as an argument; nothing reads from a global.
 */

import { applyCommissionBps, assertPoisha } from "./money";

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------

export interface CommissionContext {
  totalPoisha: number;
  serviceId?: string | null;
  categoryId?: string | null;
}

export interface CommissionRuleRecord {
  id: string;
  name: string;
  commissionBps: number;
  serviceId: string | null;
  categoryId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export const DEFAULT_COMMISSION_BPS = 1200; // 12%

/**
 * Most specific active rule wins: service beats category beats global.
 * Returns null when no rule matches so the caller can decide the fallback
 * rather than silently inheriting a surprising rate.
 */
export function resolveCommissionBps(
  rules: readonly CommissionRuleRecord[],
  context: CommissionContext,
  now: Date = new Date(),
): CommissionRuleRecord | null {
  const applicable = rules.filter((rule) => {
    if (!rule.isActive) return false;
    if (rule.effectiveFrom > now) return false;
    if (rule.effectiveTo && rule.effectiveTo <= now) return false;
    return true;
  });

  const specificity = (rule: CommissionRuleRecord): number => {
    if (context.serviceId && rule.serviceId === context.serviceId) return 3;
    if (context.categoryId && rule.categoryId === context.categoryId) return 2;
    if (!rule.serviceId && !rule.categoryId) return 1;
    return 0;
  };

  let best: CommissionRuleRecord | null = null;
  let bestScore = 0;
  for (const rule of applicable) {
    const score = specificity(rule);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export interface CommissionSplit {
  commissionPoisha: number;
  providerPoisha: number;
  bps: number;
  source: "RULE" | "DEFAULT";
  ruleId: string | null;
}

/**
 * Splits a total. The provider's share is the remainder after the commission,
 * so the two always sum back to the total exactly. That property is what makes
 * payout reconciliation possible.
 */
export function computeCommission(input: {
  totalPoisha: number;
  rules?: readonly CommissionRuleRecord[];
  serviceId?: string | null;
  categoryId?: string | null;
  defaultBps?: number;
  now?: Date;
}): CommissionSplit {
  const totalPoisha = assertPoisha(input.totalPoisha, "totalPoisha");
  const now = input.now ?? new Date();

  const rule = input.rules?.length
    ? resolveCommissionBps(input.rules, input, now)
    : null;

  const bps = rule?.commissionBps ?? input.defaultBps ?? DEFAULT_COMMISSION_BPS;
  const { commissionPoisha, providerPoisha } = applyCommissionBps(totalPoisha, bps);

  return {
    commissionPoisha,
    providerPoisha,
    bps,
    source: rule ? "RULE" : "DEFAULT",
    ruleId: rule?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export interface CancellationPolicy {
  /** Free cancellation up to this many hours before the scheduled start. */
  freeCancelHours: number;
  /** Between freeCancelHours and lateCancelHours, a visit fee applies. */
  lateCancelHours: number;
  /** Charge for cancelling inside lateCancelHours, and for a provider no-show. */
  lateCancelFeePoisha: number;
  /** Charge when the provider cancels, whatever the timing. */
  providerCancelFeePoisha: number;
  /** Charged to the customer who does not appear. */
  customerNoShowFeePoisha: number;
  /** Charged to the provider who does not appear. */
  providerNoShowFeePoisha: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeCancelHours: 12,
  lateCancelHours: 2,
  lateCancelFeePoisha: 20_000, // BDT 200
  providerCancelFeePoisha: 0,
  customerNoShowFeePoisha: 30_000, // BDT 300
  providerNoShowFeePoisha: 0,
};

export type CancellationOutcome =
  | {
      kind: "FREE";
      feePoisha: 0;
      /** Everything captured is returned. A provider-initiated cancellation
       *  still refunds, because the provider caused it. */
      refundPoisha: number;
      message: string;
    }
  | {
      kind: "LATE_FEE";
      feePoisha: number;
      refundPoisha: number;
      message: string;
    }
  | {
      kind: "NO_SHOW_FEE";
      feePoisha: number;
      refundPoisha: number;
      message: string;
    }
  | {
      kind: "ADMIN_WAIVED";
      feePoisha: 0;
      refundPoisha: number;
      message: string;
    };

/**
 * What cancelling costs, given who is cancelling and how close the booking is.
 *
 * `capturedPoisha` is what has actually been taken. A fee is only ever
 * *withheld* from a capture, never charged beyond it: cancelling before any
 * money moved cannot produce a negative refund.
 */
export function evaluateCancellation(input: {
  cancelledBy: "CUSTOMER" | "PROVIDER" | "ADMIN";
  scheduledAt: Date;
  now?: Date;
  capturedPoisha: number;
  policy?: CancellationPolicy;
  /** Set by an admin to forgive the fee during a goodwill resolution. */
  waiveFee?: boolean;
}): CancellationOutcome {
  const policy = input.policy ?? DEFAULT_CANCELLATION_POLICY;
  const now = input.now ?? new Date();
  const captured = assertPoisha(input.capturedPoisha, "capturedPoisha");
  const hoursUntilStart = (input.scheduledAt.getTime() - now.getTime()) / 3_600_000;

  if (input.cancelledBy === "ADMIN" || input.waiveFee) {
    return {
      kind: "ADMIN_WAIVED",
      feePoisha: 0,
      refundPoisha: captured,
      message: "Cancelled by FixBondhu support. Any collected amount is refunded.",
    };
  }

  if (input.cancelledBy === "PROVIDER") {
    // The provider caused the cancellation, so the customer is made whole.
    return {
      kind: "FREE",
      feePoisha: 0,
      refundPoisha: captured,
      message: "The provider cancelled, so you are not charged.",
    };
  }

  // Customer-initiated.
  if (hoursUntilStart >= policy.freeCancelHours) {
    return {
      kind: "FREE",
      feePoisha: 0,
      refundPoisha: captured,
      message: "Cancelled free of charge.",
    };
  }

  if (hoursUntilStart >= policy.lateCancelHours) {
    const fee = Math.min(policy.lateCancelFeePoisha, captured);
    return {
      kind: "LATE_FEE",
      feePoisha: fee,
      refundPoisha: Math.max(0, captured - fee),
      message: `Late cancellation. A visit fee of BDT ${fee / 100} applies.`,
    };
  }

  // Inside the late window, or already past the start time.
  const fee = Math.min(policy.lateCancelFeePoisha, captured);
  return {
    kind: "LATE_FEE",
    feePoisha: fee,
    refundPoisha: Math.max(0, captured - fee),
    message: `Cancelled within ${policy.lateCancelHours}h of the appointment. A fee of BDT ${fee / 100} applies.`,
  };
}

export type NoShowParty = "CUSTOMER" | "PROVIDER";

export interface NoShowOutcome {
  feePoisha: number;
  chargedTo: NoShowParty;
  /** True when FixBondhu refunds the innocent party. */
  refundInnocentPartyPoisha: number;
  message: string;
}

/**
 * A no-show is only ever recorded once, and only by the party that was kept
 * waiting or by an admin. The innocent party is refunded and the provider's
 * no-show count moves, which is what keeps the response-rate and reliability
 * figures honest.
 */
export function evaluateNoShow(input: {
  absentParty: NoShowParty;
  capturedPoisha: number;
  policy?: CancellationPolicy;
}): NoShowOutcome {
  const policy = input.policy ?? DEFAULT_CANCELLATION_POLICY;
  const captured = assertPoisha(input.capturedPoisha, "capturedPoisha");

  if (input.absentParty === "CUSTOMER") {
    return {
      feePoisha: Math.min(policy.customerNoShowFeePoisha, captured),
      chargedTo: "CUSTOMER",
      refundInnocentPartyPoisha: 0,
      message: `Recorded as a customer no-show. Up to BDT ${policy.customerNoShowFeePoisha / 100} may be retained.`,
    };
  }

  return {
    feePoisha: 0,
    chargedTo: "PROVIDER",
    refundInnocentPartyPoisha: captured,
    message:
      "Recorded as a provider no-show. The customer is refunded in full and the provider's reliability is reduced.",
  };
}

// ---------------------------------------------------------------------------
// Booking totals
// ---------------------------------------------------------------------------

export interface BookingTotalInput {
  basePricePoisha: number;
  travelFeePoisha?: number;
  /** Sum of APPROVED additional charge requests only. */
  approvedExtrasPoisha?: number;
  discountPoisha?: number;
}

/**
 * Assembles the payable total from parts that are each independently
 * auditable. Approved extras are passed in already filtered by approval status
 * at the call site, so a pending request can never affect what is owed.
 */
export function computeBookingTotal(input: BookingTotalInput): {
  totalPoisha: number;
  components: BookingTotalInput;
} {
  const base = assertPoisha(input.basePricePoisha, "basePricePoisha");
  const travel = assertPoisha(input.travelFeePoisha ?? 0, "travelFeePoisha");
  const extras = assertPoisha(input.approvedExtrasPoisha ?? 0, "approvedExtrasPoisha");
  const discount = assertPoisha(input.discountPoisha ?? 0, "discountPoisha");

  const subtotal = base + travel + extras;
  // A discount can never exceed the subtotal; the booking is never negative.
  const appliedDiscount = Math.min(discount, subtotal);
  const total = subtotal - appliedDiscount;

  return {
    totalPoisha: total,
    components: { ...input, discountPoisha: appliedDiscount },
  };
}

/** Validates that a provider's advertised price band is coherent. */
export function isValidPriceBand(input: {
  minPricePoisha: number;
  maxPricePoisha: number;
  basePricePoisha?: number | null;
}): boolean {
  const { minPricePoisha, maxPricePoisha, basePricePoisha } = input;
  if (minPricePoisha < 0 || maxPricePoisha < 0) return false;
  if (minPricePoisha > maxPricePoisha) return false;
  if (basePricePoisha != null) {
    if (basePricePoisha < minPricePoisha || basePricePoisha > maxPricePoisha) {
      return false;
    }
  }
  return true;
}
