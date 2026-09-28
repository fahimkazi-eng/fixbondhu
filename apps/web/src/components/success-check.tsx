/**
 * The booking success moment.
 *
 * A ring draws itself, then the check strokes on, then the detail fades up. All
 * stroke-dashoffset and opacity, so nothing reflows and the whole thing is
 * collapsed by the blanket prefers-reduced-motion rule.
 *
 * The arrival line underneath states a real scheduled time from the booking. It
 * is not "a technician will arrive soon", which is the kind of sentence a
 * marketplace writes when it has not actually scheduled anything.
 */
export function SuccessCheck({
  scheduledAt,
  providerName,
  reference,
}: {
  scheduledAt: Date;
  providerName: string;
  reference: string;
}) {
  const when = scheduledAt.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="card animate-pop p-6 text-center">
      <div className="relative mx-auto h-16 w-16">
        {/* Ring burst. Sits behind the tick and fades as it expands. */}
        <svg
          aria-hidden
          viewBox="0 0 64 64"
          className="check-ring absolute inset-0 h-16 w-16 text-brand-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="32" cy="32" r="30" />
        </svg>

        <svg
          aria-hidden
          viewBox="0 0 64 64"
          className="relative h-16 w-16 text-brand-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="check-draw" d="M18 33.5L28 43L46 22" />
        </svg>
      </div>

      <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink-900">
        Booking confirmed
      </h2>

      <p className="mt-1 text-sm text-ink-600">
        Your reference is{" "}
        <span className="font-medium tabular-nums text-ink-900">{reference}</span>
      </p>

      <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4 text-left">
        <p className="text-sm font-medium text-ink-900">{providerName}</p>
        <p className="mt-0.5 text-sm text-ink-600">Arriving {when}</p>
      </div>

      {/*
        The honest caveat, stated up front. Nothing is paid until the work is
        agreed, and a provider cannot raise the total without approval. This is
        the product's actual promise, so it belongs on the confirmation rather
        than buried in the terms.
      */}
      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        Nothing has been charged yet. If the work needs extra parts or a longer
        visit, {providerName.split(/\s+/)[0]} must send a request and you approve
        the price before anything changes.
      </p>
    </div>
  );
}
