import Link from "next/link";
import type { Metadata } from "next";

import { formatPoisha } from "@fixbondhu/core";

import {
  listCategoriesWithCounts,
  listServicesWithCounts,
  listAreasByDistrict,
} from "@/lib/marketplace";
import { CategoryIcon } from "@/components/category-icon";
import { Reveal } from "@/components/reveal";
import {
  MobileTabBar,
  SiteFooter,
  SiteHeader,
  TabBarSpacer,
} from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "All services",
  description:
    "Every home service FixBondhu offers in Bangladesh, with real prices and the number of verified professionals available for each.",
};

export const dynamic = "force-dynamic";

/**
 * The service catalogue.
 *
 * This is the discovery surface the marketplace was missing: before it, a
 * customer could search but not browse, and every search result linked to a
 * page that did not exist.
 *
 * Two deliberate choices:
 *   - services with no provider still appear, showing 0 available. Hiding them
 *     would imply FixBondhu does not offer the trade; showing 0 is the truth and
 *     it tells the customer the supply is not there yet.
 *   - the price shown is the lowest real price from a real ACTIVE provider, or
 *     nothing at all. There is no "from ৳300" without someone actually charging
 *     it.
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoryFilter = Array.isArray(params.category) ? params.category[0] : params.category;
  const areaFilter = Array.isArray(params.area) ? params.area[0] : params.area;

  const [categories, services, areas] = await Promise.all([
    listCategoriesWithCounts(),
    listServicesWithCounts(),
    listAreasByDistrict(),
  ]);

  const visibleCategories = categoryFilter
    ? categories.filter((c) => c.slug === categoryFilter)
    : categories;

  // A category with no services still gets a section, saying so.
  const sections = visibleCategories.map((category) => ({
    category,
    services: services.filter((s) => s.categorySlug === category.slug),
  }));

  const areaName = areaFilter
    ? areas.flatMap((d) => d.areas).find((a) => a.slug === areaFilter)?.nameEn
    : undefined;

  const availableCount = sections.reduce(
    (sum, s) => sum + s.services.filter((x) => x.providerCount > 0).length,
    0,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader path="/services" signedInName={null} areaName={null} />

      <main id="main" className="container-page flex-1 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          All services
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {services.length} services across {categories.length} categories.{" "}
          {availableCount} {availableCount === 1 ? "has" : "have"} a verified
          professional available right now.
        </p>

        {/*
          Catalogue search, distinct from the header one: this is the only place
          with an area filter. Laid out as a grid so it stays one row on wider
          screens instead of stacking the input, the select and the button into
          three full-width bands.
        */}
        <form method="get" action="/search" className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor="q">
            What do you need?
          </label>
          <input
            className="input h-11"
            id="q"
            name="q"
            type="search"
            placeholder="AC repair, plumber, গিজার"
          />
          <label className="sr-only" htmlFor="area">
            Area
          </label>
          <select
            className="input h-11 sm:w-44"
            id="area"
            name="location"
            defaultValue={areaFilter ?? ""}
          >
            <option value="">Any area</option>
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
          <button className="btn btn-primary h-11 px-5" type="submit">
            Search
          </button>
        </form>

        {areaName ? (
          <p className="mt-3 text-sm text-ink-600">
            Browsing all services{areaName ? ` for ${areaName}` : ""}.{" "}
            <Link href="/services" className="underline">
              Clear
            </Link>
          </p>
        ) : null}

        {/* ---- category rail ---- */}
        <nav aria-label="Categories" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/services"
                aria-current={!categoryFilter ? "true" : undefined}
                className={`chip ${!categoryFilter ? "tone-accent" : "hover:border-ink-300"}`}
              >
                All
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/services?category=${category.slug}`}
                  aria-current={categoryFilter === category.slug ? "true" : undefined}
                  className={`chip inline-flex items-center gap-1.5 ${
                    categoryFilter === category.slug
                      ? "tone-accent"
                      : "hover:border-ink-300"
                  }`}
                >
                  <CategoryIcon name={category.icon} className="h-3.5 w-3.5" />
                  {category.nameEn}
                  <span className="tabular-nums text-ink-400">
                    {category.providerCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ---- sections ---- */}
        {services.length === 0 ? (
          <div className="card mt-6 p-8 text-center">
            <p className="text-sm text-ink-600">No categories have been published yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {sections.map(({ category, services: items }) => (
              <Reveal key={category.slug}>
                <section aria-labelledby={`cat-${category.slug}`}>
                <div className="flex items-baseline justify-between gap-3 border-b border-ink-200 pb-2">
                  <h2
                    id={`cat-${category.slug}`}
                    className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink-900"
                  >
                    <CategoryIcon name={category.icon} className="h-4.5 w-4.5 text-ink-500" />
                    {category.nameEn}
                    <span lang="bn" className="text-sm font-normal text-ink-500">
                      {category.nameBn}
                    </span>
                  </h2>
                  <p className="shrink-0 text-xs tabular-nums text-ink-500">
                    {category.serviceCount} services ·{" "}
                    {category.providerCount} {category.providerCount === 1 ? "provider" : "providers"}
                  </p>
                </div>

                {items.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-500">
                    No services published in this category yet.
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((service, i) => (
                      <li
                        key={service.id}
                        className="animate-rise"
                        style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                      >
                        <Link
                          href={`/services/${service.slug}`}
                          className="card interactive flex h-full flex-col p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium text-ink-900">
                              {service.nameEn}
                            </h3>
                            {service.isEmergency ? (
                              <span className="chip shrink-0 text-ink-600">Urgent</span>
                            ) : null}
                          </div>

                          <p lang="bn" className="mt-0.5 text-sm text-ink-600">
                            {service.nameBn}
                          </p>

                          <div className="mt-auto pt-3">
                            {service.providerCount > 0 ? (
                              <>
                                <p className="text-xs text-ink-500">
                                  {service.providerCount}{" "}
                                  {service.providerCount === 1 ? "professional" : "professionals"}{" "}
                                  available
                                </p>
                                {service.fromPricePoisha !== null ? (
                                  <p className="text-sm font-semibold tabular-nums text-ink-900">
                                    From {formatPoisha(service.fromPricePoisha)}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              /*
                                The honest state. Not a disabled button and not a
                                fabricated price: nobody is available, so it says
                                so.
                              */
                              <p className="text-xs text-ink-500">
                                No professional available yet
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                </section>
              </Reveal>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
      <MobileTabBar path="/services" />
      <TabBarSpacer />
    </div>
  );
}
