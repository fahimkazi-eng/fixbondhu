/**
 * Demo banner.
 *
 * Rendered only when NEXT_PUBLIC_DEMO_MODE is set, which is done for the demo
 * deployment and nowhere else. Without it, a demo provider could be mistaken
 * for a real one — which is the exact failure the project's own rules forbid.
 * The banner is deliberately unmissable rather than a subtle footnote.
 */
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div
      role="status"
      className="tone-warning border-b"
    >
      <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
        <p>
          <strong className="font-semibold">Demo environment.</strong> These
          providers, bookings and reviews are sample data on a separate database
          branch. They are not real people and nothing here can be booked for
          real.
        </p>
        <span className="chip tone-warning">
          Sample data
        </span>
      </div>
    </div>
  );
}
