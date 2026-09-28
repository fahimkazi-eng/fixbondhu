import { CategoryGridSkeleton } from "@/components/skeletons";

/**
 * Shown while /services resolves.
 *
 * The page is server-rendered from a handful of aggregate queries, so this is
 * the gap between tapping a category chip and the catalogue appearing. Without
 * it the screen is blank white, which reads as broken on a slow connection.
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
        <span className="shimmer block h-6 w-40 rounded" />
        <span className="shimmer mt-3 block h-4 w-72 rounded" />

        <div className="mt-6 flex gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="shimmer h-7 w-24 rounded-full" />
          ))}
        </div>

        <div className="mt-8 space-y-10">
          {Array.from({ length: 2 }, (_, i) => (
            <section key={i}>
              <span className="shimmer block h-5 w-48 rounded" />
              <CategoryGridSkeleton count={4} />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
