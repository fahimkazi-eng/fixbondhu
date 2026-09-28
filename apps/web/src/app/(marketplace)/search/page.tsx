import Link from "next/link";
import type { Metadata } from "next";

import { formatPoisha, formatPoishaRange } from "@fixbondhu/core";
import { BrandMark } from "@/components/brand-mark";


import { searchServices, logSearch } from "@/lib/search";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search services",
  // Search result pages must never be indexed: they are personalised by
  // location and would otherwise create an unbounded number of near-duplicate
  // pages in search engines.
  robots: { index: false, follow: true },
};

interface PageProps {
  searchParams: Promise<{ q?: string; location?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  if (!query) {
    return (
      <Shell query="">
        <EmptyState
          level={1}
          title="What do you need?"
          body="Search in English, Bangla or Banglish. For example: AC repair, বাসার ইলেকট্রিশিয়ান, or fan thik korte hobe."
        />
      </Shell>
    );
  }

  const { hits, parsed } = await searchServices({ query, limit: 30 });
  const user = await getUser();

  // Fire-and-forget demand signal. Failure is swallowed inside logSearch so a
  // search never breaks because logging did.
  void logSearch({
    userId: user?.id ?? null,
    parsed,
    locationId: params.location ?? null,
    resultCount: hits.length,
  });

  return (
    <Shell query={query}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">
          Results for <span className="font-normal text-ink-600">“{query}”</span>
        </h1>
        <p className="text-xs text-ink-500">
          {hits.length} {hits.length === 1 ? "service" : "services"}
        </p>
      </div>

      {hits.length === 0 ? (
        <EmptyState
          title="No matching service yet"
          body={`We could not find a service matching “${query}”. FixBondhu only lists services it can actually dispatch, so a gap here means the service is not covered in your area yet.`}
        />
      ) : (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li key={hit.serviceId}>
              <Link
                href={`/services/${hit.slug}`}
                className="card block p-4 transition-colors hover:border-ink-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-medium text-ink-900">
                        {hit.nameEn}
                      </h2>
                      {hit.isEmergency ? (
                        <span className="chip tone-danger">
                          Emergency
                        </span>
                      ) : null}
                    </div>
                    <p lang="bn" className="mt-0.5 text-sm text-ink-600">
                      {hit.nameBn}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {hit.categoryNameEn}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {hit.minPricePoisha !== null ? (
                      <p className="text-sm font-medium tabular-nums text-ink-900">
                        {hit.minPricePoisha === hit.maxPricePoisha
                          ? formatPoisha(hit.minPricePoisha)
                          : formatPoishaRange(
                              hit.minPricePoisha,
                              hit.maxPricePoisha ?? hit.minPricePoisha,
                            )}
                      </p>
                    ) : (
                      <p className="text-sm text-ink-500">Price on request</p>
                    )}
                    <p className="mt-1 text-xs text-ink-500">
                      {hit.availableProviders === 0
                        ? "No providers yet"
                        : `${hit.availableProviders} ${
                            hit.availableProviders === 1 ? "provider" : "providers"
                          }`}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-relaxed text-ink-500">
        Prices shown are estimates from each provider&apos;s published range. Your
        final price is agreed before work starts, and a provider cannot increase
        it without your approval.
      </p>
    </Shell>
  );
}

function Shell({ query, children }: { query: string; children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-ink-300/60 bg-ink-100/40">
        <div className="container-page flex h-14 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <BrandMark className="h-7 w-7" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
              FixBondhu
            </span>
          </Link>
          <form action="/search" method="get" className="flex flex-1 gap-2">
            <label className="sr-only" htmlFor="q">
              Search services
            </label>
            <input
              className="input h-9 text-sm"
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search services"
            />
            <button className="btn btn-secondary h-9" type="submit">
              Search
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="container-page py-6">
        {children}
      </main>
    </>
  );
}

/**
 * The no-results / no-query panel.
 *
 * `level` exists because the two call sites are not the same. With a query the
 * page already owns an <h1> ("Results for ..."), so this is an <h2>. Without a
 * query there is no other heading on the page at all, and a page whose top
 * heading is an <h2> is a real accessibility defect, not a style preference:
 * screen-reader users navigate by heading level, and starting a document at
 * level 2 reads as though content above it went missing.
 */
function EmptyState({
  title,
  body,
  level = 2,
}: {
  title: string;
  body: string;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="card px-6 py-12 text-center">
      <Heading className="text-[15px] font-medium text-ink-900">{title}</Heading>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-600">
        {body}
      </p>
    </div>
  );
}
