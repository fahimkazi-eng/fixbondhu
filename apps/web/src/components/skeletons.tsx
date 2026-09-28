/**
 * Skeleton placeholders for route transitions.
 *
 * Next.js renders these while a server component is being fetched, which is
 * exactly the "skeleton cards instead of blank screens" case. They mirror the
 * real layout closely enough that nothing jumps when the data lands.
 *
 * Every bar is a fixed proportion of the real thing. A skeleton that does not
 * match the eventual layout causes a visible reflow, which defeats the point.
 */

function Bar({ w = "100%", h = "h-3" }: { w?: string; h?: string }) {
  return (
    <span
      aria-hidden
      className={`shimmer block ${h} rounded`}
      style={{ width: w }}
    />
  );
}

export function ProviderCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="shimmer h-12 w-12 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Bar w="60%" />
          <Bar w="85%" h="h-2.5" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="shimmer h-5 w-20 rounded-full" />
        <span className="shimmer h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3">
        <Bar w="70%" h="h-2.5" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="space-y-2">
          <Bar w="40%" h="h-2.5" />
          <Bar w="55%" h="h-4" />
        </div>
        <div className="flex gap-2">
          <span className="shimmer h-8 w-16 rounded-lg" />
          <span className="shimmer h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProviderGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Loading professionals"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProviderCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="card p-4">
      <Bar w="70%" />
      <div className="mt-2">
        <Bar w="45%" h="h-2.5" />
      </div>
      <div className="mt-6 space-y-2">
        <Bar w="55%" h="h-2.5" />
        <Bar w="35%" h="h-4" />
      </div>
    </div>
  );
}

export function ServiceGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading services"
    >
      {Array.from({ length: count }, (_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      role="status"
      aria-label="Loading categories"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-2 p-4">
          <Bar w="55%" />
          <Bar w="40%" h="h-2.5" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Skeleton for the filter rail, so the layout does not collapse then expand. */
export function FilterSkeleton() {
  return (
    <div className="card space-y-5 p-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bar w="30%" h="h-2.5" />
          <span className="shimmer block h-9 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * The sticky header, mid-load.
 *
 * `header-shell` rather than a plain bordered band, and h-14 rather than the
 * old h-14-inside-a-padded-band. The header compacts its own padding on scroll,
 * so a skeleton that renders the same box at a different height is what causes
 * the page to jump the instant real content replaces it — which is the exact
 * moment the reader is looking.
 */
export function HeaderSkeleton() {
  return (
    <div className="header-shell sticky top-0 z-30 border-b border-ink-300/50">
      <div className="container-page flex h-14 items-center gap-3">
        <span className="shimmer h-7 w-7 rounded-[9px]" />
        <span className="shimmer h-4 w-24 rounded" />
        <span className="shimmer ml-auto hidden h-9 w-full max-w-xl md:block" />
        <span className="shimmer h-9 w-20 rounded-[10px]" />
      </div>
    </div>
  );
}

/** A page title block: eyebrow, heading, one line of supporting copy. */
export function PageHeadSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <span className="shimmer block h-3 w-24 rounded" />
      <span className="shimmer block h-8 w-72 max-w-full rounded" />
      <span className="shimmer block h-4 w-96 max-w-full rounded" />
    </div>
  );
}

/**
 * The content-area skeleton for the three signed-in surfaces.
 *
 * Deliberately chrome-free, and that is not an oversight. A loading.tsx placed in
 * a segment replaces that segment's page but NOT its layout, so the customer,
 * pro and admin shells — headers, navs, tab bars — keep rendering around this.
 * Including a header here would draw it twice.
 *
 * It is also the one skeleton that has to work at three different widths without
 * knowing which surface it is on, so it mirrors only what all three share: a
 * title, a toolbar row, and a stack of full-width panels. Anything more specific
 * would be wrong on at least one of them.
 */
export function PanelSkeleton({
  count = 3,
  className = "py-6",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`container-page ${className}`}
      role="status"
      aria-label="Loading"
    >
      <PageHeadSkeleton />
      <div className="mt-4 flex flex-wrap gap-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="shimmer h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-6 space-y-3" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card space-y-2.5 p-4">
            <Bar w="34%" />
            <Bar w="72%" h="h-2.5" />
            <Bar w="48%" h="h-2.5" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
