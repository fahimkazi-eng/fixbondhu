"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared form shell for the account forms.
 *
 * Submitting happens through fetch rather than a native form post so the
 * pending and error states can be rendered inline. That matters on a phone over
 * a patchy connection: a native submit gives no feedback and the user taps
 * again, which is how duplicate accounts happen.
 */
export function AuthForm({
  action,
  fields,
  submitLabel,
  createAccountHref,
  footer,
}: {
  action: string;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "tel" | "password";
    autoComplete: string;
    hint?: string;
    placeholder?: string;
  }>;
  submitLabel: string;
  createAccountHref?: string;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setPending(true);
    setFormError(null);
    setErrors({});

    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as {
        error?: { message: string; details?: Record<string, string> };
      };

      if (!response.ok) {
        if (payload.error?.details) {
          setErrors(payload.error.details);
        }
        setFormError(payload.error?.message ?? "Something went wrong. Try again.");
        return;
      }

      // A full navigation, not a client-side push: the session cookie was just
      // set, and the server components on the next page must read it.
      router.push("/account");
      router.refresh();
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    /*
     * method="post" is a security control, not a detail.
     *
     * Without it the form defaults to GET, so any submit that happens before
     * hydration, or with JavaScript disabled, navigates to
     * /login?phone=...&password=... and puts the password in the URL. That
     * writes it to server access logs, the browser history, and any proxy along
     * the way. onSubmit calls preventDefault, but preventDefault only exists
     * once the JavaScript has loaded; this attribute is what makes the failure
     * mode "request fails" instead of "password leaks".
     *
     * POST-ing to the page rather than the API is deliberate. Without
     * JavaScript there is no way to submit JSON, and a failed request is a much
     * better outcome than a successful one that leaks the credential.
     */
    <form method="post" onSubmit={onSubmit} noValidate className="card mt-6 space-y-4 p-5">
      {fields.map((field) => {
        const error = errors[field.name];
        const errorId = `${field.name}-error`;
        const hintId = `${field.name}-hint`;
        return (
          <div key={field.name}>
            <label className="label" htmlFor={field.name}>
              {field.label}
            </label>
            <input
              className="input"
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                [error ? errorId : null, field.hint ? hintId : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              disabled={pending}
            />
            {error ? (
              <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600">
                {error}
              </p>
            ) : field.hint ? (
              <p id={hintId} className="mt-1.5 text-xs text-ink-500">
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}

      {/*
        role="alert" so a screen reader announces the failure. Without it a
        screen reader user would see the form simply stop responding.
      */}
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {formError}
        </p>
      ) : null}

      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </button>

      {createAccountHref ? (
        <p className="text-center text-sm text-ink-600">
          New to FixBondhu?{" "}
          <a href={createAccountHref} className="font-medium text-brand-700 underline">
            Create an account
          </a>
        </p>
      ) : null}

      {footer}
    </form>
  );
}
