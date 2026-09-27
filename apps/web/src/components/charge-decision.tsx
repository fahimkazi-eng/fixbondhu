"use client";

import { useActionState } from "react";

import { respondToAdditionalCharge, type ActionState } from "@/app/actions/customer";
import { FormFeedback } from "@/components/submit-button";

/**
 * Additional charge approval.
 *
 * This is the single place a booking total can increase, and it is always the
 * customer's decision. The amount and reason are shown before the buttons, and
 * declining is presented as an ordinary outcome rather than an error.
 */
export function ChargeDecision({
  charge,
}: {
  charge: { id: string; amountPoisha: number; reason: string };
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    respondToAdditionalCharge,
    null,
  );

  if (state?.ok) {
    return (
      <div className="card animate-pop border-brand-200 bg-brand-50 p-4">
        <p className="text-sm text-brand-800">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card animate-rise border-amber-300 bg-amber-50 p-5">
      <input type="hidden" name="requestId" value={charge.id} />

      <h2 className="text-sm font-semibold text-amber-900">
        Your provider is asking for an extra charge
      </h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-900">
        ৳{(charge.amountPoisha / 100).toLocaleString("en-US")}
      </p>
      <p className="mt-1.5 text-sm text-amber-900">{charge.reason}</p>

      <p className="mt-3 text-xs leading-relaxed text-amber-800">
        Your provider has explained the extra work. Nothing is added to your bill
        unless you approve it, and you can decline and end the booking instead.
      </p>

      <div className="mt-3">
        <label className="label text-amber-900" htmlFor={`note-${charge.id}`}>
          Reply (optional)
        </label>
        <input
          className="input"
          id={`note-${charge.id}`}
          name="note"
          maxLength={500}
          placeholder="e.g. Yes, but please use the original part"
          disabled={pending}
        />
      </div>

      <div className="mt-3 space-y-2">
        <FormFeedback state={state} />
        <div className="flex gap-2">
          <button
            type="submit"
            name="decision"
            value="REJECTED"
            className="btn btn-secondary flex-1"
            disabled={pending}
          >
            Decline
          </button>
          <button
            type="submit"
            name="decision"
            value="APPROVED"
            className="btn btn-primary flex-1"
            disabled={pending}
          >
            {pending ? "Saving…" : "Approve"}
          </button>
        </div>
      </div>
    </form>
  );
}
