"use client";

import type { ActionState } from "@/app/actions/customer";

/**
 * Form feedback primitives.
 *
 * Deliberately no generic submit button here. Every form uses useActionState
 * directly, because each one needs different pending copy and some need to
 * render several submit buttons with different values (approve versus decline).
 * A shared wrapper would have to grow options for every variation and would
 * still be less clear at the call site.
 */

/** Inline result banner for a form action. */
export function FormFeedback({ state }: { state: ActionState | null }) {
  if (!state) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`animate-fade-in rounded-md border px-3 py-2 text-sm ${
        state.ok
          ? "tone-accent"
          : "tone-danger"
      }`}
    >
      {state.message}
    </p>
  );
}

/** Field-level error text, announced to assistive technology. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-fade-in mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}
