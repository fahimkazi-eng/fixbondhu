import { FilterSkeleton, ProviderGridSkeleton } from "@/components/skeletons";

/**
 * Shown while /providers resolves.
 *
 * The filter rail is included, because a grid-only skeleton would collapse the
 * two-column layout and then shove the results sideways when the real page
 * arrived. Same shape, less content.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <div className="border-b border-ink-300/60 bg-ink-100/40">
        <div className="container-page flex h-14 items-center">
          <span className="shimmer h-7 w-28 rounded-md" />
        </div>
      </div>

      <main className="container-page flex-1 py-6">
        <span className="shimmer block h-6 w-56 rounded" />
        <span className="shimmer mt-3 block h-4 w-40 rounded" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <FilterSkeleton />
          <div>
            <div className="mb-4 flex gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="shimmer h-7 w-24 rounded-full" />
              ))}
            </div>
            <ProviderGridSkeleton count={6} />
          </div>
        </div>
      </main>
    </div>
  );
}
