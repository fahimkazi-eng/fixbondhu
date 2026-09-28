"use client";

import { useActionState } from "react";

import { decideVerification, type ActionState } from "@/app/actions/admin";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Verification decision.
 *
 * A rejection REQUIRES a reason. Approving a document someone has not properly
 * proved is how a fake provider ends up on the platform, and declining without
 * explanation is how a legitimate one gives up and takes their business
 * elsewhere, so the reason is mandatory rather than a nicety.
 */
export function VerificationDecision({
  verificationId,
  providerName,
  type,
}: {
  verificationId: string;
  providerName: string;
  type: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    decideVerification,
    null,
  );

  if (state?.ok) {
    return (
      <p className="animate-pop tone-accent rounded-md px-3 py-2 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="verificationId" value={verificationId} />

      <div>
        <label className="label" htmlFor={`reason-${verificationId}`}>
          Reason (required to reject)
        </label>
        <textarea
          className="input min-h-16 resize-y"
          id={`reason-${verificationId}`}
          name="reason"
          maxLength={300}
          placeholder={
            type === "IDENTITY"
              ? "e.g. The NID image is cut off at the bottom"
              : "e.g. The trade certificate has expired"
          }
          disabled={pending}
        />
        <FieldError message={state?.fieldErrors?.reason} />
      </div>

      <FormFeedback state={state} />

      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="REJECTED"
          className="btn btn-danger flex-1"
          disabled={pending}
        >
          Reject
        </button>
        <button
          type="submit"
          name="decision"
          value="APPROVED"
          className="btn btn-primary flex-1"
          disabled={pending}
        >
          {pending ? "Saving…" : `Approve ${type.toLowerCase()}`}
        </button>
      </div>

      <p className="text-xs text-ink-500">
        Approving marks {providerName}&apos;s document as checked. Once identity
        and business or certificate are approved, their profile goes live
        automatically.
      </p>
    </form>
  );
}
