"use client";

import Link from "next/link";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";

/**
 * The global error boundary.
 *
 * Self-contained for the same reason as not-found.tsx: this is the root
 * boundary, so it is the last thing standing for all three surfaces the proxy
 * can serve. It renders its own header instead of SiteHeader, which would put a
 * marketplace nav bar above an admin who is mid-task.
 *
 * Two details worth keeping:
 *
 *   - The message shown is the real one, not a paraphrase. "Something went
 *     wrong" tells a customer nothing they can act on, and hides the fact that
 *     the site is genuinely broken rather than merely empty.
 *
 *   - The error is logged to the console with its own stack, because a boundary
 *     that swallows the error is the single easiest way to make a production
 *     incident invisible. Next.js also logs it server-side, but only for errors
 *     that escape a server render; a client event handler that throws lands only
 *     here.
 *
 * `retry`, not `reset`. In 16.3 `retry` is the stable prop and it re-fetches as
 * well as re-rendering, which is the behaviour that actually recovers from a
 * transient database blip. `reset` re-renders the same failed data.
 *
 * This is app/error.tsx, not app/global-error.tsx. That distinction matters:
 * this file renders INSIDE the root layout, so globals.css, the three
 * self-hosted fonts and the dark theme all apply. A global-error boundary
 * replaces the root layout, comes with no stylesheet at all, and would have to
 * re-declare the entire theme inline.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("FixBondhu error boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink-300/50">
        <div className="container-page flex h-14 items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">
            FixBondhu
          </span>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center py-20">
        <div className="container-page">
          <div className="max-w-xl">
            <p className="eyebrow">Something broke</p>
            <h1 className="display mt-4 text-[clamp(2rem,6vw,3.25rem)] text-ink-900">
              This page failed to load.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-600">
              That is our fault, not yours. Nothing you submitted was lost, and
              trying again is usually enough.
            </p>

            {/* The digest is the handle support uses to find this exact failure
                in the logs, so it is shown rather than hidden. */}
            {error.digest ? (
              <p className="mt-4 font-mono text-xs text-ink-600">
                Reference: {error.digest}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-2">
              <button type="button" onClick={() => retry()} className="btn btn-primary">
                Try again
              </button>
              <Link href="/" className="btn btn-secondary">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
