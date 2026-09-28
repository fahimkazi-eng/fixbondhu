"use client";

import Link from "next/link";
import { useActionState } from "react";

import { completeProfile, type CompleteState } from "@/app/actions/account";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Client side of the post-Google step.
 *
 * Extracted into its own file because useActionState is a client-only API and
 * this lives under a server component that handles the redirect.
 */
export function CompleteProfileForm() {
  const [state, formAction, pending] = useActionState<CompleteState | null, FormData>(
    completeProfile,
    null,
  );

  if (state?.ok) {
    return (
      <div className="card animate-pop border-brand-200 bg-brand-50 p-5">
        <p className="text-sm text-brand-800">{state.message}</p>
        <Link href="/account" className="btn btn-primary mt-4 w-full">
          Go to my account
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="card mt-5 space-y-4 p-5">
      <div>
        <label className="label" htmlFor="phone">
          Mobile number
        </label>
        <input
          className="input"
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          placeholder="01712 345678"
          aria-invalid={state?.fieldErrors?.phone ? true : undefined}
          aria-describedby={state?.fieldErrors?.phone ? "phone-error" : undefined}
          disabled={pending}
        />
        <FieldError message={state?.fieldErrors?.phone} />
      </div>

      <FormFeedback
        state={state ? { ok: state.ok, message: state.message } : null}
      />

      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
