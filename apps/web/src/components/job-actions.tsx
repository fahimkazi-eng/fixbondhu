"use client";

import { useActionState, useState } from "react";

import {
  providerTransition,
  requestAdditionalCharge,
  type ActionState,
} from "@/app/actions/provider";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Job action bar.
 *
 * Only transitions the state machine allows for a provider are offered, and the
 * reason for each is spelled out. The button set is derived from the booking
 * status, so a provider is never shown an action the server would reject.
 */
export function JobActions({
  bookingId,
  status,
  paymentMethod,
  paymentCaptured,
}: {
  bookingId: string;
  status: string;
  paymentMethod: string;
  paymentCaptured: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    providerTransition,
    null,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);

  const gateway = paymentMethod !== "CASH";
  const blockedByPayment = gateway && !paymentCaptured;

  type Action = { to: string; label: string; variant?: string; hint?: string };

  const actions: Action[] = [];
  switch (status) {
    case "REQUESTED":
      actions.push(
        { to: "ACCEPTED", label: "Accept job", variant: "btn-primary" },
        {
          to: "REJECTED",
          label: "Decline",
          variant: "btn-danger",
          hint: "The customer is told straight away and is not charged.",
        },
      );
      break;
    case "ACCEPTED":
      actions.push({ to: "ON_THE_WAY", label: "I am on the way", variant: "btn-primary" });
      break;
    case "ON_THE_WAY":
      actions.push({ to: "ARRIVED", label: "I have arrived", variant: "btn-primary" });
      break;
    case "ARRIVED":
      actions.push({ to: "IN_PROGRESS", label: "Start work", variant: "btn-primary" });
      break;
    case "IN_PROGRESS":
      actions.push({
        to: "COMPLETED",
        label: "Mark job complete",
        variant: "btn-primary",
        hint: blockedByPayment
          ? "Blocked: the customer has not paid yet. They see the payment request on their side."
          : "Only mark complete once the work is genuinely finished.",
      });
      break;
    case "DISPUTED":
      actions.push({
        to: "CANCELLED",
        label: "Cancel (dispute open)",
        variant: "btn-danger",
        hint: "Disputes are normally resolved by FixBondhu, not by cancelling.",
      });
      break;
    default:
      break;
  }

  if (status === "ACCEPTED" || status === "ON_THE_WAY" || status === "ARRIVED") {
    actions.push({ to: "CANCELLED", label: "Cancel job", variant: "btn-danger" });
  }

  if (actions.length === 0) {
    return (
      <p className="card px-4 py-3 text-sm text-ink-600">
        This job is {status.toLowerCase().replace("_", " ")}. No further action is
        available from here.
      </p>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-ink-900">Update this job</h2>

      <FormFeedback state={state} />

      {confirmCancel ? (
        <form action={formAction} className="animate-rise tone-danger space-y-3 p-3">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="to" value="CANCELLED" />
          <p className="text-sm text-red-800">
            Cancelling a job you accepted is recorded against your reliability.
            The customer is refunded anything already paid.
          </p>
          <div>
            <label className="label text-red-900" htmlFor={`cancel-reason-${bookingId}`}>
              Reason
            </label>
            <input
              className="input"
              id={`cancel-reason-${bookingId}`}
              name="reason"
              maxLength={300}
              placeholder="e.g. I am unwell and cannot attend"
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={() => setConfirmCancel(false)}
              disabled={pending}
            >
              Go back
            </button>
            <button type="submit" className="btn btn-danger flex-1" disabled={pending}>
              {pending ? "Cancelling…" : "Confirm cancel"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => {
            // Completion is the only action that can be blocked by payment. The
            // server refuses it regardless; this just avoids a dead button.
            const disabled = pending || (action.to === "COMPLETED" && blockedByPayment);

            if (action.to === "CANCELLED") {
              return (
                <button
                  key={action.to}
                  type="button"
                  className="btn btn-danger w-full"
                  onClick={() => setConfirmCancel(true)}
                  disabled={pending}
                >
                  {action.label}
                </button>
              );
            }

            return (
              <form key={action.to} action={formAction}>
                <input type="hidden" name="bookingId" value={bookingId} />
                <input type="hidden" name="to" value={action.to} />
                <button
                  type="submit"
                  className={`btn ${action.variant ?? "btn-secondary"} w-full`}
                  disabled={disabled}
                >
                  {pending ? "Saving…" : action.label}
                </button>
                {action.hint ? (
                  <p
                    className={`mt-1.5 text-xs leading-relaxed ${
                      action.to === "COMPLETED" && blockedByPayment
                        ? "font-medium text-amber-700"
                        : "text-ink-500"
                    }`}
                  >
                    {action.hint}
                  </p>
                ) : null}
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Additional charge request.
 *
 * Presented as a request, never as a price change, and the copy says the work
 * cannot continue until the customer responds. That framing is the mechanism
 * that stops a provider quietly inflating a bill.
 */
export function ChargeRequestForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    requestAdditionalCharge,
    null,
  );
  const [amount, setAmount] = useState("");

  if (state?.ok) {
    return (
      <div className="card animate-pop tone-accent p-4">
        <p className="text-sm text-brand-200">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-3 p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <h2 className="text-sm font-semibold text-ink-900">Need to charge more?</h2>
      <p className="text-xs leading-relaxed text-ink-600">
        If the job needs work or parts that were not in the agreed scope, ask the
        customer here. <strong>The job total does not change until they approve
        it</strong>, and the work should pause until they answer.
      </p>

      <div>
        <label className="label" htmlFor={`amount-${bookingId}`}>
          Extra amount (BDT)
        </label>
        <input
          className="input tabular-nums"
          id={`amount-${bookingId}`}
          name="amountPoisha"
          inputMode="numeric"
          required
          placeholder="500"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          disabled={pending}
        />
        <p className="mt-1.5 text-xs text-ink-500">
          Enter taka. Sent as ৳{amount ? (Number(amount) || 0).toFixed(0) : "0"}.
        </p>
        <FieldError message={state?.fieldErrors?.amountPoisha} />
      </div>

      <div>
        <label className="label" htmlFor={`reason-${bookingId}`}>
          Why is this needed?
        </label>
        <textarea
          className="input min-h-20 resize-y"
          id={`reason-${bookingId}`}
          name="reason"
          required
          minLength={5}
          maxLength={300}
          placeholder="e.g. The capacitor has failed and needs replacing. It was working when I quoted."
          disabled={pending}
        />
        <FieldError message={state?.fieldErrors?.reason} />
      </div>

      <FormFeedback state={state} />

      <button className="btn btn-primary w-full" type="submit" disabled={pending || !amount}>
        {pending ? "Sending…" : "Request approval"}
      </button>
    </form>
  );
}
