import Link from "next/link";

import { TabIcon } from "@/components/tab-icon";

/**
 * The marketplace shell: one header and one tab bar for every public page.
 *
 * These were previously duplicated per page, which is how the homepage, the
 * service pages and the account shell ended up with three different headers.
 * One component means the search box, the area chip and the tab bar cannot drift
 * apart from each other.
 *
 * The tab bar is the one piece of the brief that had to earn its place on a
 * phone: a marketplace is browsed one-handed, and the five destinations that
 * matter are Home, Search, Services, Bookings and Account.
 */

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/services", label: "Services", icon: "grid" },
  { href: "/bookings", label: "Bookings", icon: "calendar" },
  { href: "/account", label: "Account", icon: "user" },
] as const;

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function SiteHeader({
  path,
  signedInName,
  areaName,
}: {
  path: string;
  signedInName: string | null;
  /** Only set when the customer has a real saved default address. */
  areaName: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
      <div className="container-page flex h-14 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white"
          >
            F
          </span>
          <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
        </Link>

        {/*
          Search is centred and prominent on desktop, the way a
          marketplace-first site leads. Hidden below md because the tab bar
          already carries Search and a phone header cannot fit both.
        */}
        <form
          action="/search"
          method="get"
          className="hidden flex-1 justify-center md:flex"
          role="search"
        >
          <div className="relative w-full max-w-xl">
            <label className="sr-only" htmlFor="site-search">
              Search services
            </label>
            <input
              className="input h-9 pl-9 text-sm"
              id="site-search"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="AC repair, plumber, গিজার"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            >
              <TabIcon name="search" className="h-4 w-4" />
            </span>
          </div>
        </form>

        <nav className="ml-auto flex shrink-0 items-center gap-1">
          {areaName ? (
            // Only shown when it is real: the customer's own default address.
            // There is no "guessing your location", and no city-wide claim.
            <Link
              href="/providers"
              className="hidden text-sm text-ink-600 hover:text-ink-900 lg:inline"
              title="Based on your saved default address"
            >
              {areaName}
            </Link>
          ) : null}

          <Link
            href="/services"
            className={`hidden text-sm lg:inline ${
              isActive(path, "/services") ? "text-brand-700" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            Services
          </Link>
          <Link
            href="/providers"
            className={`hidden text-sm lg:inline ${
              isActive(path, "/providers") ? "text-brand-700" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            Professionals
          </Link>
          <Link
            href="/pro"
            className={`hidden text-sm lg:inline ${
              isActive(path, "/pro") ? "text-brand-700" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            Become a Pro
          </Link>

          <Link href="/account" className="btn btn-primary h-9 px-3 text-sm">
            {signedInName ? signedInName.split(/\s+/)[0]! : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * Fixed bottom tab bar, phones only.
 *
 * Fixed rather than sticky so it behaves like an app tab bar, with padding
 * reserved on the page so the last row is never hidden behind it.
 */
export function MobileTabBar({ path }: { path: string }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(path, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
                  active ? "text-brand-700" : "text-ink-500"
                }`}
              >
                <TabIcon name={tab.icon} className="h-5 w-5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reserves room for the fixed tab bar so content is never trapped under it. */
export function TabBarSpacer() {
  return <div aria-hidden className="h-16 md:hidden" />;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200 bg-white">
      <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p>FixBondhu — local services, properly verified.</p>
        <nav className="flex gap-4">
          <Link href="/services" className="hover:text-ink-800">
            Services
          </Link>
          <Link href="/providers" className="hover:text-ink-800">
            Professionals
          </Link>
          <Link href="/support" className="hover:text-ink-800">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
