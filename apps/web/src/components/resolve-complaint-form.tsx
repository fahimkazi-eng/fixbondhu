"use client";

import { useActionState } from "react";

import { resolveComplaint, type ActionState } from "@/app/actions/admin";
import { FormFeedback } from "@/components/submit-button";

const RESOLUTIONS = [
  { value: "REFUND_FULL", label: "Full refund to the customer" },
  { value: "REFUND_PARTIAL", label: "Partial refund" },
  { value: "NO_REFUND", label: "No refund — complaint dismissed" },
  { value: "PROVIDER_PENALTY", label: "Record a penalty against the provider" },
  { value: "WARNING_ISSUED", label: "Warning the provider" },
  { value: "ACCOUNT_SUSPENDED", label: "Suspend the provider" },
  { value: "OTHER", label: "Other (explain below)" },
];

/**
 * Dispute resolution.
 *
 * The decision text is mandatory and every decision writes an audit row, because
 * a dispute closed with no recorded reasoning is one a provider can never
 * challenge and a customer can never understand. The form names the consequence
 * of each option rather than offering a bare dropdown of codes.
 */
export function ResolveComplaintForm({ complaintId }: { complaintId: string }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    resolveComplaint,
    null,
  );

  if (state?.ok) {
    return (
      <div className="animate-pop tone-accent rounded-md px-3 py-2 text-sm">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="complaintId" value={complaintId} />

      <div>
        <label className="label" htmlFor={`resolutionType-${complaintId}`}>
          Decision
        </label>
        <select
          className="input"
          id={`resolutionType-${complaintId}`}
          name="resolutionType"
          required
          defaultValue="REFUND_PARTIAL"
        >
          {RESOLUTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor={`resolution-${complaintId}`}>
          What was decided and why
        </label>
        <textarea
          className="input min-h-24 resize-y"
          id={`resolution-${complaintId}`}
          name="resolution"
          required
          minLength={5}
          maxLength={1000}
          placeholder="e.g. Photos show the joint had failed before the visit. Half the charge is refunded; the provider is warned."
          disabled={pending}
        />
        <p className="mt-1.5 text-xs text-ink-500">
          The customer is shown this. Write it for them, not for a file.
        </p>
      </div>

      <FormFeedback state={state} />

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record decision and resolve"}
      </button>
    </form>
  );
}
