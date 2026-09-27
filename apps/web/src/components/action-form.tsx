"use client";

import { useActionState } from "react";

import type { ActionState } from "@/app/actions/provider";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Generic form runner for the provider's simple edit screens.
 *
 * Every one of these forms has the same shape — fields, submit, inline field
 * errors, a result banner — and the actions all return ActionState. One runner
 * keeps the pending and error behaviour identical everywhere, and keeps the
 * action functions usable from anywhere rather than being bound to a page.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  children,
  className = "card space-y-4 p-5",
  resetOnSuccess = false,
}: {
  action: (prev: ActionState | null, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className={className}>
      {children}
      <div className="space-y-3 pt-1">
        <FormFeedback state={state} />
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

export { FieldError };
