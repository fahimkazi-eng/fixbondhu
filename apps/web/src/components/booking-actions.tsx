"use client";

import { useActionState, useState } from "react";

import { cancelBooking, type ActionState } from "@/app/actions/customer";
import { FormFeedback } from "@/components/submit-button";

/**
 * Cancellation.
 *
 * A confirmation step is required because the cost is time-dependent: the fee
 * is a server decision based on how close the appointment is, so the form
 * states that a late cancellation may carry a visit fee rather than pretending
 * cancelling is always free.
 */
export function BookingActions({
  bookingId,
  canCancel,
}: {
  bookingId: string;
  canCancel: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    cancelBooking,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (!canCancel) return null;

  if (state?.ok) {
    return (
      <div className="card animate-pop tone-accent p-4">
        <p className="text-sm text-brand-200">{state.message}</p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-danger w-full"
        onClick={() => setConfirming(true)}
      >
        Cancel this booking
      </button>
    );
  }

  return (
    <form action={formAction} className="card animate-rise tone-danger p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm font-medium text-ink-900">Cancel this booking?</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">
        Cancelling close to the appointment time may carry a visit fee, because
        the provider has already set aside the slot. The exact amount is worked
        out when you confirm.
      </p>

      <div className="mt-3">
        <label className="label" htmlFor="reason">Reason (optional)</label>
        <input
          className="input"
          id="reason"
          name="reason"
          maxLength={300}
          placeholder="e.g. Problem resolved itself"
          disabled={pending}
        />
      </div>

      <div className="mt-3 space-y-2">
        <FormFeedback state={state} />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Keep booking
          </button>
          <button
            type="submit"
            className="btn btn-danger flex-1"
            disabled={pending}
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </form>
  );
}
