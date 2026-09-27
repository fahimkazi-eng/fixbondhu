import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";

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
 */
export default async function HomePage() {
  const [categories, serviceCount, providerCount, activeBookings] =
    await Promise.all([
      prisma.category.findMany({
        where: { isActive: true, isPublished: true },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameBn: true,
          icon: true,
          _count: { select: { services: { where: { isPublished: true } } } },
        },
      }),
      prisma.service.count({ where: { isActive: true, isPublished: true } }),
      prisma.providerProfile.count({ where: { status: "ACTIVE" } }),
      prisma.booking.count({
        where: { status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] } },
      }),
    ]);

  return (
    <>
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white"
            >
              F
            </span>
            <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
            <Link href="/pro" className="btn btn-primary hidden sm:inline-flex">
              Join as a provider
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ---- search ---- */}
        <section className="border-b border-ink-200 bg-white">
          <div className="container-page py-10 md:py-14">
            <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-ink-900 md:text-[32px] md:leading-tight">
              Find someone who can fix it, near you
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-ink-600">
              Search in English, Bangla or Banglish.
            </p>

            <form action="/search" method="get" className="mt-6 flex gap-2">
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
                  placeholder="AC repair, বাসার ইলেকট্রিশিয়ান, fan thik korte hobe"
                />
              </div>
              <button className="btn btn-primary h-12 px-5" type="submit">
                Search
              </button>
            </form>

            <p className="mt-3 text-xs text-ink-500">
              Try: <Link href="/search?q=plumber" className="underline">plumber</Link>,{" "}
              <Link href="/search?q=এসি+রিপেয়ার" className="underline">এসি রিপেয়ার</Link>,{" "}
              <Link href="/search?q=geyser" className="underline">geyser</Link>
            </p>
          </div>
        </section>

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
        <section className="container-page pb-16">
          <h2 className="text-base font-semibold tracking-tight text-ink-900">
            Browse by category
          </h2>

          {categories.length === 0 ? (
            <p className="card mt-3 p-6 text-sm text-ink-600">
              No categories have been published yet.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/search?q=${encodeURIComponent(category.nameEn)}`}
                    className="card block p-4 transition-colors hover:border-ink-300"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">
                        {category.nameEn}
                      </span>
                      <span className="shrink-0 text-xs text-ink-400">
                        {category._count.services}
                      </span>
                    </div>
                    <p lang="bn" className="mt-0.5 text-sm text-ink-600">
                      {category.nameBn}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

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

      <footer className="border-t border-ink-200 bg-white">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>FixBondhu — local services, properly verified.</p>
          <nav className="flex gap-4">
            <Link href="/support" className="hover:text-ink-800">Support</Link>
            <Link href="/terms" className="hover:text-ink-800">Terms</Link>
            <Link href="/privacy" className="hover:text-ink-800">Privacy</Link>
          </nav>
        </div>
      </footer>
    </>
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
