"use client";

import { useActionState } from "react";

import { generatePayouts, type ActionState } from "@/app/actions/admin";
import { FormFeedback } from "@/components/submit-button";

/**
 * Payout generator.
 *
 * Deliberately explicit rather than automatic. A batch is built from captured
 * payments that are not already attached to a payout, and the unique constraint
 * on (payoutId, paymentId) means running this twice cannot pay the same money
 * twice. Finance can then review and approve each batch before it goes out.
 */
export function GeneratePayoutsButton() {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    generatePayouts,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Building…" : "Build payouts from captured payments"}
      </button>
      <p className="text-xs leading-relaxed text-ink-500">
        Creates one pending payout per provider from payments that have been
        captured and not yet paid out. Nothing is sent to anyone until a batch is
        approved below.
      </p>
    </form>
  );
}
