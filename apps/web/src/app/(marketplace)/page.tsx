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
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { HeroShell } from "@/components/hero-shell";
import { HeroPanel } from "@/components/hero-panel";
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
 *
 * That rule is also why the hero has no stock photography. A picture of a
 * technician is a picture of nobody: not verified, not available, not real.
 * The hero's imagery is the live marketplace state, rendered by HeroPanel.
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
        {/* ---- hero ----
            Two columns from lg up: the promise on the left, the live state of
            the marketplace on the right. The hero is the only full-bleed
            treatment on the site; everything below it is a plain band. */}
        <HeroShell>
          <section className="border-b border-ink-300/50">
            <div className="container-page grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
              <div>
                {/*
                  The eyebrow is a status line, not marketing filler. It reports
                  the same count the panel does, and it renders the empty
                  variant rather than claiming activity that does not exist.
                */}
                <p className="eyebrow">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      hasSupply ? "animate-pulse bg-brand-400" : "bg-ink-500"
                    }`}
                  />
                  {hasSupply
                    ? `${providerCount} verified ${providerCount === 1 ? "professional" : "professionals"} live`
                    : "Opening city by city"}
                </p>

                <h1 className="display mt-5 text-[clamp(2.5rem,7vw,4.25rem)] text-ink-900">
                  Find someone who can{" "}
                  <span className="text-accent">fix it</span>, near you.
                </h1>

                <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-600 md:text-lg">
                  Electricians, plumbers, AC technicians and repair professionals
                  — identity-checked, priced upfront, and bookable in minutes.
                </p>

                {/*
                  The header carries a prominent search from md up, so showing a
                  second one in the hero left two identical boxes on every desktop
                  page. This one is the mobile search only; the header's is hidden
                  below md, so exactly one is ever on screen.
                */}
                <form
                  action="/search"
                  method="get"
                  className="mt-8 flex gap-2 md:max-w-lg"
                >
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

                {/* Example queries: on a phone the hero is already tight, so
                    these stay a desktop affordance. */}
                <p className="mt-4 hidden text-xs text-ink-500 md:block">
                  Try{" "}
                  <Link
                    href="/search?q=plumber"
                    className="link-underline text-ink-700"
                  >
                    plumber
                  </Link>
                  ,{" "}
                  <Link
                    href="/search?q=এসি+রিপেয়ার"
                    className="bn-text link-underline text-ink-700"
                  >
                    এসি রিপেয়ার
                  </Link>
                  ,{" "}
                  <Link
                    href="/search?q=geyser"
                    className="link-underline text-ink-700"
                  >
                    geyser
                  </Link>
                </p>
              </div>

              {/*
                Hidden below lg. The panel is the only thing in the layout that
                can afford to be deferred on a phone, and above lg the left
                column is short enough that the right column reads as the second
                beat of the same thought rather than as a second block.
              */}
              <div className="hidden lg:block">
                <HeroPanel
                  serviceCount={serviceCount}
                  providerCount={providerCount}
                  activeBookings={activeBookings}
                  categoryCount={categories.length}
                  services={bookable.map((s) => ({
                    slug: s.slug,
                    nameEn: s.nameEn,
                    nameBn: s.nameBn,
                    providerCount: s.providerCount,
                  }))}
                />
              </div>
            </div>
          </section>
        </HeroShell>

        {/* ---- quick help ----
            Rendered only from services with real supply. An "urgent" tile that
            leads to an empty page is worse than no tile. */}
        {emergency.length > 0 ? (
          <section className="border-b border-ink-300/50 bg-ink-100/25">
            <div className="container-page py-12 md:py-16">
              <SectionHead
                eyebrow="Urgent"
                title="Need help urgently"
                action={{ href: "/services", label: "All services" }}
              />
              <Reveal className="mt-6">
                <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {emergency.map((service, i) => (
                    <li
                      key={service.id}
                      className="h-full"
                      style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                    >
                      <Link
                        href={`/services/${service.slug}`}
                        className="card interactive group flex h-full flex-col p-4"
                      >
                        <span className="text-sm font-medium text-ink-900">
                          {service.nameEn}
                        </span>
                        <span lang="bn" className="mt-0.5 text-sm text-ink-600">
                          {service.nameBn}
                        </span>
                        {/*
                          A count of zero here would mean the customer is about to
                          tap through to an empty result page, so the tile is only
                          rendered at all when the count is above zero.
                        */}
                        <span className="mt-auto pt-3 text-xs tabular-nums text-ink-500">
                          {service.providerCount} available
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* ---- top professionals ----
            Gated on real supply. This is the section most likely to tempt a
            template into showing six invented cards, so it is the one that most
            needs the guard. */}
        {hasSupply && topProviders.length > 0 ? (
          <section className="container-page py-14 md:py-20">
            <SectionHead
              eyebrow="Ranked"
              title="Top rated professionals"
              action={{ href: "/providers", label: `See all ${providerCount}` }}
            />
            <p className="mt-2 text-sm text-ink-500">
              Ordered by real ratings and completed jobs, with sponsored placements
              labelled.
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topProviders.map((provider, i) => (
                <ProviderCard key={provider.id} provider={provider} index={i} />
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- categories ----
            Wrapped in Reveal so the section arrives as it is scrolled to. Each
            card is a group so the icon can zoom with the card, per the brief. */}
        {categories.length > 0 ? (
          <section className="border-y border-ink-300/50 bg-ink-100/25">
            <div className="container-page py-14 md:py-20">
              <SectionHead
                eyebrow="Browse"
                title="Browse by category"
                action={{ href: "/services", label: `All ${serviceCount} services` }}
              />
              <Reveal size="lg" className="mt-7">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/services?category=${category.slug}`}
                        className="card group hover-lift flex h-full flex-col p-4"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="media-zoom text-ink-500 transition-colors duration-200 group-hover:text-brand-300">
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
                          {category.providerCount === 1
                            ? "professional"
                            : "professionals"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* ---- popular services ---- */}
        {popular.length > 0 ? (
          <section className="container-page py-14 md:py-20">
            <SectionHead eyebrow="Common jobs" title="Popular services" />
            <Reveal className="mt-7">
              <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
                {popular.map((service, i) => (
                  <li
                    key={service.id}
                    className="h-full"
                    style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                  >
                    <Link
                      href={`/services/${service.slug}`}
                      className="card interactive flex h-full flex-col p-4"
                    >
                      <span className="text-sm font-medium text-ink-900">
                        {service.nameEn}
                      </span>
                      <span className="mt-auto pt-3 text-xs tabular-nums text-ink-500">
                        {service.providerCount} available
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>
        ) : null}

        {/* ---- book again / recommended ----
            Rendered only for a signed-in customer, and only from real booking
            history. Both sections return null when there is nothing to base them
            on, so a new customer simply does not see them. */}
        {user ? <PersonalRail customerId={user.id} /> : null}

        {/* ---- launch state ---- */}
        {providerCount === 0 ? (
          <section className="border-t border-ink-300/50 bg-ink-100/25">
            <div className="container-page py-16">
              <h2 className="display text-3xl text-ink-900 md:text-4xl">
                We are opening city by city
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">
                FixBondhu launches in a locality only once there are real,
                identity-verified providers there to take the work. Showing a long
                list of unverified electricians would waste your time and put your
                home at risk, so we would rather show you nothing than show you
                something fake.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
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

        {/* ---- honest platform state ----
            Last, rather than directly under the hero. Four numbers in a row
            under the headline competes with the headline; here they read as the
            footnote they actually are. */}
        <section className="border-t border-ink-300/50">
          <div className="container-page py-12">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Services" value={serviceCount} />
              <Stat label="Categories" value={categories.length} />
              <Stat label="Verified providers" value={providerCount} />
              <Stat label="Jobs in progress" value={activeBookings} />
            </dl>
            <p className="mt-4 text-xs text-ink-500">
              Counts are read live from the database. FixBondhu does not display
              invented figures.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
      <MobileTabBar path="/" />
      <TabBarSpacer />
    </div>
  );
}

/**
 * One section header, used five times.
 *
 * The eyebrow-then-title pattern is the main structural device on the page, so
 * it is defined once. The action link is a plain Link with no underline
 * decoration on mobile, because on a phone the two most likely targets for a
 * mis-tap are the row of cards immediately below it.
 */
function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink-900 md:text-2xl">
          {title}
        </h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="link-underline text-sm text-brand-300"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3.5">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink-900">
        {/*
          CountUp only animates the journey to the number the server already
          read from the database. It cannot invent one: if JS does not run, the
          server-rendered value is what stands.
        */}
        <CountUp value={value} />
      </dd>
    </div>
  );
}
