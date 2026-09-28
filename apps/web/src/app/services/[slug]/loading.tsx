import { ProviderGridSkeleton } from "@/components/skeletons";

/** Shown while a service page resolves. */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <div className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center">
          <span className="shimmer h-7 w-28 rounded-md" />
        </div>
      </div>

      <main className="container-page flex-1 py-6">
        <span className="shimmer block h-3 w-40 rounded" />

        <div className="mt-3 space-y-2">
          <span className="shimmer block h-7 w-64 rounded" />
          <span className="shimmer block h-5 w-40 rounded" />
        </div>

        <div className="mt-5 space-y-2">
          <span className="shimmer block h-4 w-full max-w-2xl rounded" />
          <span className="shimmer block h-4 w-3/4 max-w-xl rounded" />
        </div>

        <div className="mt-6">
          <ProviderGridSkeleton count={3} />
        </div>
      </main>
    </div>
  );
}
