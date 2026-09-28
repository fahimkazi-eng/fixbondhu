"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Continue with Google" button using Google Identity Services.
 *
 * Google renders the button inside an iframe it owns, which is deliberate: it
 * keeps the Google logo and the credential handling out of our page's control,
 * so phishing risk and cookie tracking are Google's problem rather than ours.
 *
 * The credential is posted to our own server, which verifies it. The browser is
 * never trusted with the result, and nothing is stored client-side.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode: string;
            context: string;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "fixbondhu-gsi";

export function GoogleSignInButton({
  clientId,
  intent,
}: {
  clientId: string;
  intent: "signin" | "signup";
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !containerRef.current || !window.google) return;
      // Rendered once only. Re-rendering on a state change would make Google
      // reload its iframe and lose focus mid-click.
      if (containerRef.current.childElementCount > 0) {
        setReady(true);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "popup",
        // FedCM: the modern consent flow, so Google does not read third-party
        // cookies to tell whether the user is already signed in.
        context: "signin",
        callback: async (response: { credential: string }) => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: response.credential, intent }),
            });
            const payload = (await res.json()) as {
              error?: { message?: string };
              needsPhone?: boolean;
            };

            if (!res.ok) {
              setError(payload.error?.message ?? "Google sign-in failed. Please try again.");
              setPending(false);
              return;
            }

            // A brand-new Google account has no phone number, so it is sent to
            // add one before it can book anything.
            router.push(payload.needsPhone ? "/account/complete" : "/account");
            router.refresh();
          } catch {
            setError("We could not reach the server. Check your connection.");
            setPending(false);
          }
        },
      });

      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: Math.min(360, containerRef.current.offsetWidth || 360),
        text: intent === "signup" ? "signup_with" : "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
      });
      setReady(true);
    }

    // Reuse an existing script tag if the component remounts, so Google is
    // fetched once per page rather than once per button.
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => {
        if (!cancelled) {
          setError("Could not load Google sign-in. Check your connection.");
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, intent, router]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-xs text-ink-500">or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <div className="flex min-h-11 items-center justify-center">
        <div ref={containerRef} className={ready ? "" : "shimmer h-11 w-full max-w-[360px] rounded-lg"} />
      </div>

      {pending ? (
        <p role="status" className="text-center text-xs text-ink-500">
          Signing you in…
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-center text-xs text-red-600">
          {error}
        </p>
      ) : null}

      <p className="text-center text-[11px] leading-relaxed text-ink-500">
        We receive your name, email and profile photo from Google. We never see or
        store your Google password.
      </p>
    </div>
  );
}
