import { HAPPY_PATH, STATUS_LABELS, progressIndex, type BookingStatus } from "@fixbondhu/core";

/**
 * The booking progress stepper.
 *
 * The steps come from HAPPY_PATH in packages/core, which is the same array the
 * state machine validates transitions against. Reading it from one place is the
 * point: a hand-rolled list of statuses here would eventually disagree with the
 * transitions the domain actually permits, and the tracker would then promise a
 * step the booking can never reach.
 *
 * Presentation is transform and opacity only. The connector fills with scaleX
 * from a left transform-origin, so animating it costs nothing but compositing.
 */
export function BookingProgress({ status }: { status: BookingStatus }) {
  const current = progressIndex(status);

  // Cancelled, rejected, no-show and disputed are not on the happy path, and
  // progressIndex returns -1 for them. Showing a half-filled tracker there would
  // imply the job is still moving forward.
  if (current < 0) return null;

  const span = Math.max(HAPPY_PATH.length - 1, 1);
  const fillPercent = (current / span) * 100;
  const lastIndex = HAPPY_PATH.length - 1;

  return (
    <div>
      <p className="sr-only" role="status">
        Step {current + 1} of {HAPPY_PATH.length}: {STATUS_LABELS[status].en}
      </p>

      <ol className="relative flex justify-between" aria-hidden>
        <div className="absolute left-0 right-0 top-[11px] h-0.5 bg-ink-200">
          {/*
            The fill is a full-width element scaled down, rather than a
            percentage width. Animating width would reflow the row on every
            frame; scaleX is composited.
          */}
          {fillPercent > 0 ? (
            <div
              className="step-fill h-full w-full bg-brand-600"
              style={{ transform: `scaleX(${fillPercent / 100})` }}
            />
          ) : null}
        </div>

        {HAPPY_PATH.map((step, index) => {
          const done = index <= current;
          const isCurrent = index === current;
          return (
            <li key={step} className="relative z-10 flex flex-col items-center gap-1.5">
              <span
                className={`step-dot-in grid h-6 w-6 place-items-center rounded-full border-2 ${
                  done
                    ? "border-brand-600 bg-brand-600 text-ink-50"
                    : "border-ink-300 bg-ink-100 text-ink-400"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {done && !isCurrent ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5L10 17.5L19 7" />
                  </svg>
                ) : (
                  <span
                    className={`text-[10px] font-semibold ${isCurrent ? "text-brand-300" : ""}`}
                  >
                    {index + 1}
                  </span>
                )}
              </span>

              <span
                className={`max-w-[4.5rem] text-center text-[11px] leading-tight ${
                  isCurrent ? "font-medium text-ink-900" : done ? "text-ink-600" : "text-ink-400"
                }`}
              >
                {STATUS_LABELS[step].en}
              </span>
            </li>
          );
        })}
      </ol>

      {current === lastIndex ? (
        <p className="mt-3 text-center text-xs text-ink-500">
          Completed. Leave a review to help the next customer decide.
        </p>
      ) : null}
    </div>
  );
}
