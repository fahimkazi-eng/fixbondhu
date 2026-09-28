import Link from "next/link";
import type { Metadata } from "next";

import { parseBdtToPoisha } from "@fixbondhu/core";

import {
  countProviders,
  findProviders,
  listAreasByDistrict,
  listCategoriesWithCounts,
  listServicesWithCounts,
  type ProviderSort,
} from "@/lib/marketplace";
import { ProviderCard } from "@/components/provider-card";
import {
  MobileTabBar,
  SiteFooter,
  SiteHeader,
  TabBarSpacer,
} from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Find a professional",
  description:
    "Browse verified electricians, plumbers, AC technicians and repair professionals, filtered by area, price and rating.",
};

export const dynamic = "force-dynamic";

/** Sort keys are allow-listed, never passed through to a query unchecked. */
const SORTS: Array<{ key: ProviderSort; label: string }> = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Highest rated" },
  { key: "price-asc", label: "Lowest price" },
  { key: "price-desc", label: "Highest price" },
  { key: "jobs", label: "Most jobs" },
];

function isSort(value: string | undefined): value is ProviderSort {
  return SORTS.some((s) => s.key === value);
}

/** Search params arrive as string | string[] | undefined. Take the first. */
function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function truthy(v: string | string[] | undefined): boolean {
  return one(v) === "1" || one(v) === "true";
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const serviceSlug = one(params.service);
  const categorySlug = one(params.category);
  const areaSlug = one(params.area);
  const sortParam = one(params.sort);
  const sort: ProviderSort = isSort(sortParam) ? sortParam : "recommended";
  const verifiedOnly = truthy(params.verified);
  const urgentOnly = truthy(params.urgent);
  const minPrice = parseBdtToPoisha(one(params.minPrice) ?? "");
  const maxPrice = parseBdtToPoisha(one(params.maxPrice) ?? "");

  const filters = {
    serviceSlug,
    categorySlug,
    areaSlug,
    verifiedOnly,
    urgentOnly,
    minPricePoisha: minPrice ?? undefined,
    maxPricePoisha: maxPrice ?? undefined,
    sort,
  };

  // The count and the page come from the same filter set, so the number
  // announced above the results is the number of results.
  const [providers, total, categories, services, areas] = await Promise.all([
    findProviders({ ...filters, limit: 24 }),
    countProviders(filters),
    listCategoriesWithCounts(),
    listServicesWithCounts(),
    listAreasByDistrict(),
  ]);

  const areaName = areaSlug
    ? areas.flatMap((d) => d.areas).find((a) => a.slug === areaSlug)?.nameEn
    : undefined;

  const activeFilterCount =
    (serviceSlug ? 1 : 0) +
    (categorySlug ? 1 : 0) +
    (areaSlug ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (urgentOnly ? 1 : 0) +
    (minPrice !== null ? 1 : 0) +
    (maxPrice !== null ? 1 : 0);

  /** Rebuilds the query string, overriding some keys and keeping the rest. */
  function withParams(overrides: Record<string, string | null>): string {
    const merged: Record<string, string | null> = {
      service: serviceSlug ?? null,
      category: categorySlug ?? null,
      area: areaSlug ?? null,
      sort: sort === "recommended" ? null : sort,
      verified: verifiedOnly ? "1" : null,
      urgent: urgentOnly ? "1" : null,
      minPrice: minPrice === null ? null : String(minPrice / 100),
      maxPrice: maxPrice === null ? null : String(maxPrice / 100),
      ...overrides,
    };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/providers?${s}` : "/providers";
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader path="/providers" signedInName={null} areaName={null} />

      <main id="main" className="container-page flex-1 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          {serviceSlug
            ? `Professionals for this service${areaName ? ` in ${areaName}` : ""}`
            : areaName
              ? `Professionals serving ${areaName}`
              : "All professionals"}
        </h1>

        <p className="mt-1 text-sm text-ink-600">
          {total === 0
            ? "No professionals match these filters."
            : `${total} ${total === 1 ? "professional" : "professionals"} available`}
          {areaName ? ` in ${areaName}` : ""}.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* ---- filters ----
              A disclosure below lg so the results are not pushed off screen,
              and a permanent rail above it. Pure CSS, no client component. */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <details className="card filters-panel">
              <summary className="flex items-center gap-2 p-4 text-sm font-semibold text-ink-900">
                Filters
                {activeFilterCount > 0 ? (
                  <span className="chip tone-accent">{activeFilterCount} active</span>
                ) : null}
              </summary>

              <div className="filters-body border-t border-ink-200 p-4">
                <form method="get" action="/providers" className="space-y-5">
                {/* Carry the sort through a filter change. */}
                {sort !== "recommended" ? (
                  <input type="hidden" name="sort" value={sort} />
                ) : null}

              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Area
                </legend>
                <select
                  className="input mt-2"
                  name="area"
                  defaultValue={areaSlug ?? ""}
                >
                  <option value="">Anywhere</option>
                  {areas.map((district) => (
                    <optgroup key={district.district} label={district.district}>
                      {district.areas.map((area) => (
                        <option key={area.slug} value={area.slug}>
                          {area.nameEn}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Service
                </legend>
                <select
                  className="input mt-2"
                  name="service"
                  defaultValue={serviceSlug ?? ""}
                >
                  <option value="">Any service</option>
                  {services.map((service) => (
                    <option key={service.slug} value={service.slug}>
                      {service.nameEn}
                      {service.providerCount > 0 ? ` (${service.providerCount})` : ""}
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Category
                </legend>
                <select
                  className="input mt-2"
                  name="category"
                  defaultValue={categorySlug ?? ""}
                >
                  <option value="">Any category</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.nameEn} ({category.providerCount})
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Price range (৳)
                </legend>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="input"
                    name="minPrice"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Min"
                    defaultValue={minPrice === null ? "" : minPrice / 100}
                  />
                  <span aria-hidden className="text-ink-400">
                    –
                  </span>
                  <input
                    className="input"
                    name="maxPrice"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Max"
                    defaultValue={maxPrice === null ? "" : maxPrice / 100}
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Other
                </legend>
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    name="verified"
                    value="1"
                    defaultChecked={verifiedOnly}
                  />
                  Verified only
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" name="urgent" value="1" defaultChecked={urgentOnly} />
                  Takes urgent jobs
                </label>
              </fieldset>

              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" type="submit">
                  Apply
                </button>
                {activeFilterCount > 0 ? (
                  <Link href="/providers" className="btn btn-secondary">
                    Clear
                  </Link>
                ) : null}
              </div>
              </form>
            </div>
          </details>
          </aside>

          {/* ---- results ---- */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-600" role="status">
                {total > providers.length
                  ? `Showing ${providers.length} of ${total}`
                  : `${total} ${total === 1 ? "result" : "results"}`}
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-ink-500">Sort</span>
                {SORTS.map((option) => (
                  <Link
                    key={option.key}
                    href={withParams({ sort: option.key === "recommended" ? null : option.key })}
                    aria-current={sort === option.key ? "true" : undefined}
                    className={`chip transition-colors ${
                      sort === option.key
                        ? "tone-accent"
                        : "hover:border-ink-300"
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            {providers.length === 0 ? (
              <div className="card mt-4 p-8 text-center">
                <h2 className="text-sm font-semibold text-ink-900">
                  No professionals match these filters
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
                  {areaName
                    ? `We have no verified professional covering ${areaName} yet. `
                    : ""}
                  FixBondhu only lists professionals who have been approved, so an
                  empty result here means the supply genuinely is not there yet. We
                  would rather show you nothing than show you someone unvetted.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {activeFilterCount > 0 ? (
                    <Link href="/providers" className="btn btn-secondary">
                      Clear filters
                    </Link>
                  ) : null}
                  <Link href="/pro" className="btn btn-primary">
                    Apply as a provider
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {providers.map((provider, i) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    index={i}
                    highlightService={serviceSlug}
                  />
                ))}
              </ul>
            )}

            {total > providers.length ? (
              <p className="mt-4 text-xs text-ink-500">
                Showing the first {providers.length}. Narrow the filters to see the
                rest.
              </p>
            ) : null}
          </section>
        </div>
      </main>

      <SiteFooter />
      <MobileTabBar path="/providers" />
      <TabBarSpacer />
    </div>
  );
}
