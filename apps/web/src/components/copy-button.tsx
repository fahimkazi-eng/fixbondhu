"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard with real feedback.
 *
 * Booking references are read aloud to support staff over the phone, so being
 * able to copy one is a genuine support feature, not a nicety. The confirmation
 * is a state change rather than a transient toast so it cannot be missed.
 */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the reference is always visible as
      // text, so failing silently here is better than an error the user
      // cannot act on.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="chip transition-colors hover:border-ink-300"
      aria-label={`${label} ${value}`}
    >
      <span className={copied ? "animate-pop text-brand-700" : "text-ink-500"}>
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}
