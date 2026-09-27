import { HAPPY_PATH, STATUS_LABELS, progressIndex } from "@fixbondhu/core";

/**
 * Booking progress track, shared by the customer and provider views.
 *
 * The rail is drawn with a scaleX transition from the left, so the direction of
 * progress is unambiguous, and each completed dot is filled in sequence. Pure
 * CSS, no client JavaScript, so it renders correctly before hydration.
 */
export function StatusTrack({ status }: { status: string }) {
  const current = progressIndex(status as never);

  // A booking that has left the happy path (cancelled, disputed, no-show) gets a
  // plain status line instead of a progress bar, because showing a partially
  // filled "happy path" rail for a cancelled job would be a lie.
  if (current < 0) {
    return (
      <p className="text-sm text-ink-600">
        This booking is no longer in progress. The full history is below.
      </p>
    );
  }

  return (
    <ol className="relative flex justify-between">
      <div className="absolute left-0 right-0 top-[5px] h-0.5 bg-ink-200" aria-hidden>
        <div
          className="progress-fill h-full bg-brand-600"
          style={{ width: `${(current / (HAPPY_PATH.length - 1)) * 100}%` }}
        />
      </div>

      {HAPPY_PATH.map((step, index) => {
        const done = index <= current;
        return (
          <li key={step} className="relative z-10 flex flex-col items-center gap-1.5">
            <span
              className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                done ? "bg-brand-600" : "bg-ink-200"
              }`}
              aria-hidden
            />
            <span
              className={`max-w-[4.5rem] text-center text-[11px] leading-tight ${
                done ? "text-ink-900" : "text-ink-400"
              }`}
            >
              {STATUS_LABELS[step].en}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
