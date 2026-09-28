import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import {
  findProviders,
  listCategoriesWithCounts,
  listServicesWithCounts,
} from "@/lib/marketplace";
import { getCustomerArea } from "@/lib/recommendations";
import { ProviderCard } from "@/components/provider-card";
import { CategoryIcon } from "@/components/category-icon";
import { PersonalRail } from "@/components/personal-rail";
import {
  MobileTabBar,
  SiteFooter,
  SiteHeader,
  TabBarSpacer,
} from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Book verified home services in Bangladesh",
  description:
    "Electricians, plumbers, AC technicians and repair professionals near you, with upfront prices and real reviews.",
};

export const dynamic = "force-dynamic";

/**
 * Customer home.
 *
 * Every number on this page is a COUNT FROM THE DATABASE. There are no
 * hard-coded "12,000+ providers" or "50,000 happy customers" figures, because
 * inventing them is how a marketplace loses the only thing it has. If the
 * counts are zero, the page says so plainly.
 *
 * The same rule decides which sections render. "Popular near you" needs real
 * supply, so on a deployment with no approved providers the section is replaced
 * by an explanation rather than padded with example cards.
 */
export default async function HomePage() {
  const [user, categories, serviceCount, providerCount, activeBookings, services, topProviders] =
    await Promise.all([
      getUser(),
      listCategoriesWithCounts(),
      prisma.service.count({ where: { isActive: true, isPublished: true } }),
      prisma.providerProfile.count({ where: { status: "ACTIVE" } }),
      prisma.booking.count({
        where: { status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] } },
      }),
      listServicesWithCounts(),
      findProviders({ sort: "recommended", limit: 6 }),
    ]);

  /*
   * The area chip is only ever the customer's own saved default address. There
   * is no IP geolocation and no city-wide default, so nothing on this page can
   * claim to know where someone is unless they told us.
   */
  const area = user ? await getCustomerArea(user.id) : null;

  // Only services someone can actually book right now, grouped for the
  // "quick help" rail. A service with zero providers is not a call to action.
  const bookable = services.filter((s) => s.providerCount > 0);
  const emergency = bookable.filter((s) => s.isEmergency).slice(0, 4);
  const popular = bookable.filter((s) => !s.isEmergency).slice(0, 8);

  const hasSupply = providerCount > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        path="/"
        signedInName={user?.name ?? null}
        areaName={area ? area.areaName : null}
      />

      <main id="main" className="flex-1">
        {/* ---- search ---- */}
        <section className="border-b border-ink-200 bg-white">
          <div className="container-page py-10 md:py-14">
            <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-ink-900 md:text-[32px] md:leading-tight">
              Find someone who can fix it, near you
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-ink-600">
              Search in English, Bangla or Banglish.
            </p>

            {/*
              The header carries a prominent search from md up, so showing a
              second one in the hero left two identical boxes on every desktop
              page. This one is the mobile search only; the header's is hidden
              below md, so exactly one is ever on screen.
            */}
            <form action="/search" method="get" className="mt-6 flex gap-2 md:hidden">
              <div className="relative flex-1">
                <label className="sr-only" htmlFor="q">
                  What do you need fixed?
                </label>
                <input
                  className="input h-12 pr-3 text-base"
                  id="q"
                  name="q"
                  type="search"
                  autoComplete="off"
                  placeholder="AC repair, plumber, গিজার"
                />
              </div>
              <button className="btn btn-primary h-12 px-5" type="submit">
                Search
              </button>
            </form>

            {/* Example queries, desktop only: on mobile the hero is already
                short and these are a luxury. */}
            <p className="mt-3 hidden text-xs text-ink-500 md:block">
              Try:{" "}
              <Link href="/search?q=plumber" className="underline">
                plumber
              </Link>
              ,{" "}
              <Link href="/search?q=এসি+রিপেয়ার" className="bn-text underline">
                এসি রিপেয়ার
              </Link>
              ,{" "}
              <Link href="/search?q=geyser" className="underline">
                geyser
              </Link>
            </p>
          </div>
        </section>

        {/* ---- quick help ----
            Rendered only from services with real supply. An "urgent" tile that
            leads to an empty page is worse than no tile. */}
        {emergency.length > 0 ? (
          <section className="border-b border-ink-200 bg-white">
            <div className="container-page py-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight text-ink-900">
                  Need help urgently
                </h2>
                <Link href="/services" className="text-sm text-brand-700 hover:underline">
                  All services
                </Link>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {emergency.map((service, i) => (
                  <li
                    key={service.id}
                    className="animate-rise"
                    style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                  >
                    <Link
                      href={`/services/${service.slug}`}
                      className="card interactive flex h-full flex-col p-3"
                    >
                      <span className="text-sm font-medium text-ink-900">
                        {service.nameEn}
                      </span>
                      <span lang="bn" className="mt-0.5 text-xs text-ink-600">
                        {service.nameBn}
                      </span>
                      <span className="mt-auto pt-2 text-xs tabular-nums text-ink-500">
                        {service.providerCount} available
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ---- top professionals ----
            Gated on real supply. This is the section most likely to tempt a
            template into showing six invented cards, so it is the one that most
            needs the guard. */}
        {hasSupply && topProviders.length > 0 ? (
          <section className="container-page py-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight text-ink-900">
                Top rated professionals
              </h2>
              <Link href="/providers" className="text-sm text-brand-700 hover:underline">
                See all {providerCount}
              </Link>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Ordered by real ratings and completed jobs, with sponsored placements
              labelled.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topProviders.map((provider, i) => (
                <ProviderCard key={provider.id} provider={provider} index={i} />
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- honest platform state ---- */}
        <section className="container-page py-8">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Services" value={serviceCount} />
            <Stat label="Categories" value={categories.length} />
            <Stat label="Verified providers" value={providerCount} />
            <Stat label="Jobs in progress" value={activeBookings} />
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            Counts are read live from the database. FixBondhu does not display
            invented figures.
          </p>
        </section>

        {/* ---- categories ---- */}
        <section className="container-page py-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-ink-900">
              Browse by category
            </h2>
            <Link href="/services" className="text-sm text-brand-700 hover:underline">
              All {serviceCount} services
            </Link>
          </div>

          {categories.length === 0 ? (
            <p className="card mt-3 p-6 text-sm text-ink-600">
              No categories have been published yet.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category, i) => (
                <li
                  key={category.id}
                  className="animate-rise"
                  style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                >
                  <Link
                    href={`/services?category=${category.slug}`}
                    className="card interactive flex h-full flex-col p-4"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-ink-500">
                        <CategoryIcon name={category.icon} />
                      </span>
                      <span className="text-sm font-medium text-ink-900">
                        {category.nameEn}
                      </span>
                    </span>
                    <p lang="bn" className="mt-1 text-sm text-ink-600">
                      {category.nameBn}
                    </p>
                    {/*
                      Real supply per category. A category with no providers says
                      0 rather than being hidden, because the trade exists and the
                      absence is about us, not about the customer.
                    */}
                    <p className="mt-auto pt-3 text-xs tabular-nums text-ink-500">
                      {category.serviceCount} services ·{" "}
                      {category.providerCount}{" "}
                      {category.providerCount === 1 ? "professional" : "professionals"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- popular services ---- */}
        {popular.length > 0 ? (
          <section className="container-page pb-10">
            <h2 className="text-base font-semibold tracking-tight text-ink-900">
              Popular services
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {popular.map((service) => (
                <li key={service.id}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="card interactive flex h-full flex-col p-3"
                  >
                    <span className="text-sm font-medium text-ink-900">
                      {service.nameEn}
                    </span>
                    <span className="mt-auto pt-2 text-xs tabular-nums text-ink-500">
                      {service.providerCount} available
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- book again / recommended ----
            Rendered only for a signed-in customer, and only from real booking
            history. Both sections return null when there is nothing to base them
            on, so a new customer simply does not see them. */}
        {user ? <PersonalRail customerId={user.id} /> : null}

        {/* ---- launch state ---- */}
        {providerCount === 0 ? (
          <section className="border-t border-ink-200 bg-white">
            <div className="container-page py-12">
              <h2 className="text-base font-semibold tracking-tight text-ink-900">
                We are opening city by city
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                FixBondhu launches in a locality only once there are real,
                identity-verified providers there to take the work. Showing a
                long list of unverified electricians would waste your time and
                put your home at risk, so we would rather show you nothing than
                show you something fake.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/pro" className="btn btn-primary">
                  Apply as a provider
                </Link>
                <Link href="/pro/signup" className="btn btn-secondary">
                  Provider sign-up
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
      <MobileTabBar path="/" />
      <TabBarSpacer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink-900">
        {value.toLocaleString("en-US")}
      </dd>
    </div>
  );
}
