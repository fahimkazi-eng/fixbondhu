import {
  CategoryGridSkeleton,
  HeaderSkeleton,
  PageHeadSkeleton,
  ServiceGridSkeleton,
} from "@/components/skeletons";
import { TabBarSpacer } from "@/components/site-chrome";

/**
 * Home, mid-load.
 *
 * This is scoped to the (marketplace) group rather than the app root, and that
 * placement is the whole point of the group existing. A root loading.tsx wraps
 * every route that has no closer boundary, so it would render a marketplace
 * header and tab bar above the customer account shell, above /pro and above
 * /admin — three surfaces with their own chrome. Scoping it here means the
 * skeleton below only ever appears on a page whose real layout has exactly this
 * shape, so nothing shifts when the data lands.
 *
 * The hero is the expensive part of this page: four parallel database queries
 * plus the marketplace search, all of them uncached because the page is
 * force-dynamic. Until they land there is nothing truthful to render, which is
 * exactly why this mirrors the real section order rather than showing a spinner.
 *
 * Nothing here is a number. A skeleton showing invented figures that then
 * resolve to different ones is worse than an honest grey box.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <HeaderSkeleton />

      <main className="flex-1" role="status" aria-label="Loading FixBondhu">
        {/* hero */}
        <div className="border-b border-ink-300/50">
          <div className="container-page grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div>
              <span className="shimmer block h-3 w-44 rounded" />
              <span className="shimmer mt-5 block h-12 w-full max-w-lg rounded" />
              <span className="shimmer mt-3 block h-12 w-3/4 max-w-lg rounded" />
              <span className="shimmer mt-6 block h-5 w-full max-w-md rounded" />
              <div className="mt-8 flex max-w-lg gap-2">
                <span className="shimmer h-12 flex-1 rounded-[10px]" />
                <span className="shimmer h-12 w-24 rounded-[10px]" />
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="card p-5">
                <span className="shimmer block h-3 w-32 rounded" />
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <span className="shimmer h-10 rounded" />
                  <span className="shimmer h-10 rounded" />
                  <span className="shimmer h-10 rounded" />
                </div>
                <div className="mt-5 space-y-2 border-t border-ink-300/60 pt-4">
                  <span className="shimmer block h-9 w-full rounded" />
                  <span className="shimmer block h-9 w-full rounded" />
                  <span className="shimmer block h-9 w-4/5 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* a service grid */}
        <div className="container-page py-14 md:py-20">
          <PageHeadSkeleton />
          <div className="mt-7">
            <ServiceGridSkeleton count={6} />
          </div>
        </div>

        {/* the category band */}
        <div className="border-y border-ink-300/50 bg-ink-100/25">
          <div className="container-page py-14 md:py-20">
            <PageHeadSkeleton />
            <div className="mt-7">
              <CategoryGridSkeleton count={8} />
            </div>
          </div>
        </div>
      </main>

      <TabBarSpacer />
    </div>
  );
}
