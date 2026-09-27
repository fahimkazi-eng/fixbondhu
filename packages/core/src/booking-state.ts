/**
 * Booking state machine.
 *
 * The lifecycle is REQUESTED -> ACCEPTED -> ON_THE_WAY -> ARRIVED ->
 * IN_PROGRESS -> COMPLETED, with cancellation, rejection, no-show and dispute
 * branches. Every transition is declared here with the actors allowed to make
 * it, so authorisation is a lookup rather than a judgement call scattered
 * across route handlers.
 *
 * The rule that matters commercially: a provider has no path that increases the
 * price. Extras only exist through AdditionalChargeRequest, which the customer
 * must approve, and only approved amounts are ever added to the total. There is
 * deliberately no "provider edits price" transition.
 */

export const BOOKING_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "DISPUTED",
  "NO_SHOW",
  "PAYMENT_PENDING",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_ACTORS = ["CUSTOMER", "PROVIDER", "ADMIN", "SYSTEM"] as const;
export type BookingActor = (typeof BOOKING_ACTORS)[number];

export interface TransitionRule {
  to: BookingStatus;
  /** Actors permitted to perform this transition. */
  actors: readonly BookingActor[];
  /** Human sentence shown in the booking timeline. {actor} is substituted. */
  label: string;
  /**
   * True when the transition must also be paired with a Payment record moving
   * to CAPTURED. Completion on a non-cash method is not final until the
   * gateway confirms, which is why PAYMENT_PENDING exists.
   */
  requiresCapturedPayment?: boolean;
}

/**
 * Authoritative transition table. If a pair is not in this map, the action is
 * rejected server-side no matter what the client believes.
 */
export const TRANSITIONS: Readonly<
  Record<BookingStatus, readonly TransitionRule[]>
> = {
  REQUESTED: [
    {
      to: "ACCEPTED",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} accepted the request",
    },
    {
      to: "REJECTED",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} declined the request",
    },
    {
      to: "CANCELLED",
      actors: ["CUSTOMER", "PROVIDER", "ADMIN", "SYSTEM"],
      label: "{actor} cancelled the booking",
    },
  ],

  ACCEPTED: [
    {
      to: "ON_THE_WAY",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} is on the way",
    },
    {
      to: "ARRIVED",
      // A provider who is already at the door may skip the travel update.
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} arrived at the location",
    },
    {
      to: "NO_SHOW",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} marked the customer as a no-show",
    },
    {
      to: "CANCELLED",
      actors: ["CUSTOMER", "PROVIDER", "ADMIN", "SYSTEM"],
      label: "{actor} cancelled the booking",
    },
    {
      to: "DISPUTED",
      actors: ["CUSTOMER", "PROVIDER"],
      label: "{actor} raised a dispute",
    },
  ],

  ON_THE_WAY: [
    {
      to: "ARRIVED",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} arrived at the location",
    },
    {
      to: "NO_SHOW",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} marked the customer as a no-show",
    },
    {
      to: "CANCELLED",
      actors: ["CUSTOMER", "PROVIDER", "ADMIN", "SYSTEM"],
      label: "{actor} cancelled the booking",
    },
  ],

  ARRIVED: [
    {
      to: "IN_PROGRESS",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} started the work",
    },
    {
      to: "CANCELLED",
      actors: ["PROVIDER", "ADMIN", "SYSTEM"],
      // A customer who cancels after the provider has arrived has already
      // consumed the visit, so the customer loses the right to walk away free.
      label: "{actor} cancelled after arrival",
    },
    {
      to: "NO_SHOW",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} marked the customer as a no-show",
    },
    {
      to: "DISPUTED",
      actors: ["CUSTOMER", "PROVIDER"],
      label: "{actor} raised a dispute",
    },
  ],

  IN_PROGRESS: [
    {
      to: "COMPLETED",
      actors: ["PROVIDER", "ADMIN"],
      label: "{actor} marked the job complete",
      // Gated on payment exactly like PAYMENT_PENDING -> COMPLETED. Without
      // this, a provider could mark a bKash booking COMPLETED while nothing had
      // been captured, and the platform would have no record of owing money.
      // Cash is exempt because the provider collects and confirms it.
      requiresCapturedPayment: true,
    },
    {
      to: "PAYMENT_PENDING",
      actors: ["PROVIDER", "ADMIN", "SYSTEM"],
      label: "Waiting for payment confirmation",
      requiresCapturedPayment: true,
    },
    {
      to: "DISPUTED",
      actors: ["CUSTOMER", "PROVIDER"],
      label: "{actor} raised a dispute",
    },
  ],

  PAYMENT_PENDING: [
    {
      to: "COMPLETED",
      actors: ["PROVIDER", "ADMIN", "SYSTEM"],
      label: "Payment confirmed and job closed",
      requiresCapturedPayment: true,
    },
    {
      to: "DISPUTED",
      actors: ["CUSTOMER", "PROVIDER", "ADMIN"],
      label: "{actor} raised a dispute",
    },
  ],

  COMPLETED: [
    {
      to: "DISPUTED",
      actors: ["CUSTOMER", "PROVIDER", "ADMIN"],
      label: "{actor} opened a dispute after completion",
    },
  ],

  DISPUTED: [
    // Terminal for the parties; only admin resolves, and resolution routes to
    // one of the outcomes below rather than back to normal work.
    {
      to: "COMPLETED",
      actors: ["ADMIN"],
      label: "Dispute resolved in favour of completion",
    },
    {
      to: "CANCELLED",
      actors: ["ADMIN"],
      label: "Dispute resolved with cancellation and refund",
    },
  ],

  CANCELLED: [],
  REJECTED: [],
  NO_SHOW: [],
} as const;

export function isTerminalStatus(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
): boolean {
  return TRANSITIONS[from].some((rule) => rule.to === to && rule.actors.includes(actor));
}

export function findTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
): TransitionRule | undefined {
  return TRANSITIONS[from].find(
    (rule) => rule.to === to && rule.actors.includes(actor),
  );
}

/** Transitions available to an actor right now, for rendering the UI. */
export function availableTransitions(
  from: BookingStatus,
  actor: BookingActor,
): readonly TransitionRule[] {
  return TRANSITIONS[from].filter((rule) => rule.actors.includes(actor));
}

export interface TransitionRejection {
  ok: false;
  code:
    | "INVALID_TRANSITION"
    | "FORBIDDEN_ACTOR"
    | "TERMINAL_STATE"
    | "PAYMENT_NOT_CAPTURED";
  message: string;
  /** Present when the transition exists but for a different actor. */
  allowedActors?: readonly BookingActor[];
  /** Present when the transition exists but is gated on payment. */
  allowedBy?: readonly BookingActor[];
}

export type TransitionDecision =
  | { ok: true; rule: TransitionRule }
  | TransitionRejection;

/**
 * Full decision, including the payment gate. A caller must not mark a booking
 * COMPLETED on a gateway payment until the server has independently verified
 * the capture, which is what `paymentCaptured` represents.
 */
export function evaluateTransition(input: {
  from: BookingStatus;
  to: BookingStatus;
  actor: BookingActor;
  paymentCaptured: boolean;
  /** False for cash, where collection is confirmed by the provider. */
  isGatewayPayment: boolean;
}): TransitionDecision {
  const { from, to, actor, paymentCaptured, isGatewayPayment } = input;

  const existsForAnyone = TRANSITIONS[from].find((rule) => rule.to === to);
  if (!existsForAnyone) {
    return {
      ok: false,
      code: isTerminalStatus(from) ? "TERMINAL_STATE" : "INVALID_TRANSITION",
      message: isTerminalStatus(from)
        ? `A booking that is ${from} cannot change status.`
        : `A booking cannot go from ${from} to ${to}.`,
    };
  }

  const rule = findTransition(from, to, actor);
  if (!rule) {
    return {
      ok: false,
      code: "FORBIDDEN_ACTOR",
      message: `${actor} cannot move a booking from ${from} to ${to}.`,
      allowedActors: existsForAnyone.actors,
    };
  }

  if (rule.requiresCapturedPayment && isGatewayPayment && !paymentCaptured) {
    return {
      ok: false,
      code: "PAYMENT_NOT_CAPTURED",
      message:
        "The payment has not been verified as captured, so this booking cannot be completed yet.",
    };
  }

  return { ok: true, rule };
}

/** Customer-facing wording. Avoids internal jargon like NO_SHOW. */
export const STATUS_LABELS: Readonly<Record<BookingStatus, { en: string; bn: string }>> = {
  REQUESTED: { en: "Awaiting provider", bn: "প্রতিদানের অপেক্ষায়" },
  ACCEPTED: { en: "Accepted", bn: "গ্রহণ করা হয়েছে" },
  ON_THE_WAY: { en: "On the way", bn: "রওনা দিয়েছেন" },
  ARRIVED: { en: "Arrived", bn: "পৌঁছেছেন" },
  IN_PROGRESS: { en: "Work in progress", bn: "কাজ চলছে" },
  PAYMENT_PENDING: { en: "Awaiting payment", bn: "পেমেন্টের অপেক্ষায়" },
  COMPLETED: { en: "Completed", bn: "সম্পন্ন হয়েছে" },
  CANCELLED: { en: "Cancelled", bn: "বাতিল হয়েছে" },
  REJECTED: { en: "Declined", bn: "প্রত্যাখ্যান করা হয়েছে" },
  DISPUTED: { en: "Under dispute", bn: "বিতর্কের অবস্থায়" },
  NO_SHOW: { en: "No-show", bn: "উপস্থিত হননি" },
} as const;

export const STATUS_TONE: Readonly<
  Record<BookingStatus, "neutral" | "info" | "progress" | "success" | "warning" | "danger">
> = {
  REQUESTED: "neutral",
  ACCEPTED: "info",
  ON_THE_WAY: "info",
  ARRIVED: "progress",
  IN_PROGRESS: "progress",
  PAYMENT_PENDING: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
  REJECTED: "danger",
  DISPUTED: "warning",
  NO_SHOW: "danger",
} as const;

/** Ordered milestones for the progress tracker shown to both parties. */
export const HAPPY_PATH: readonly BookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export function progressIndex(status: BookingStatus): number {
  return HAPPY_PATH.indexOf(status);
}

/** True when the booking is finished for scheduling purposes. */
export function isClosed(status: BookingStatus): boolean {
  return (
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "NO_SHOW"
  );
}
