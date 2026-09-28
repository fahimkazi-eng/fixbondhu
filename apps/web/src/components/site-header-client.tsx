"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { BrandMark } from "@/components/brand-mark";
import { TabIcon } from "@/components/tab-icon";

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/providers", label: "Professionals" },
  { href: "/pro", label: "Become a Pro" },
] as const;

/**
 * The public header. Client component, for two reasons that both need the
 * scroll position.
 *
 * WHAT IS DELIBERATELY NOT HERE: React state.
 *
 * The first version of this tracked `scrolled` and `progress` in useState, which
 * meant a setState on every scroll frame — React re-rendering the entire header,
 * including the search form, up to sixty times a second while the customer
 * scrolls a results list. Both values are written straight to the DOM instead:
 * a data-attribute for the compact state, a custom property for the progress
 * bar. The browser does the rest, and scrolling costs one attribute write and
 * one variable write per frame.
 *
 * The listener is passive and rAF-gated. Passive because nothing here calls
 * preventDefault, so there is no reason to make the compositor wait on the main
 * thread; rAF-gated because a scroll event can fire several times per frame and
 * only the last position matters.
 */
export function SiteHeaderClient({
  path,
  signedInName,
  areaName,
}: {
  path: string;
  signedInName: string | null;
  /** Only set when the customer has a real saved default address. */
  areaName: string | null;
}) {
  const headerRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;

      const y = window.scrollY;

      // The compact state flips at 4px, not 0. Zero means the header compacts
      // during the elastic overscroll on iOS before the user has actually
      // started reading, and un-compacts again on the way back.
      if (y > 4 !== scrolledRef.current) {
        scrolledRef.current = y > 4;
        headerRef.current?.setAttribute("data-scrolled", String(y > 4));
      }

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) {
        const ratio = Math.min(Math.max(y / max, 0), 1);
        barRef.current?.style.setProperty("--progress", ratio.toFixed(4));
      }
    }

    function onScroll() {
      // Skip if a frame is already pending; the newest position is read inside.
      if (!frame) frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      data-scrolled="false"
      // Named so the route transition can pin it in place. Without this the
      // whole header slides with the content on every navigation, and the
      // reader loses the one fixed landmark on the page.
      style={{ viewTransitionName: "site-header" }}
      className="header-shell sticky top-0 z-30 border-b border-ink-300/50"
    >
      <div className="container-page flex h-14 items-center gap-3">
        <Link href="/" className="press flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">
            FixBondhu
          </span>
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
              className="input focus-expand h-9 pl-9 text-sm"
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
            <span className="hidden items-center gap-1.5 text-sm text-ink-500 lg:inline">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {areaName}
            </span>
          ) : null}

          {NAV.map((item) => {
            const active = isActive(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`hidden rounded-md px-2.5 py-1.5 text-sm transition-colors duration-200 lg:inline ${
                  active
                    ? "bg-brand-500/12 text-brand-200"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <Link href="/account" className="btn btn-primary h-9 px-3.5 text-sm">
            {signedInName ? signedInName.split(/\s+/)[0]! : "Sign in"}
          </Link>
        </nav>
      </div>

      <span ref={barRef} aria-hidden className="scroll-progress block" />
    </header>
  );
}

/**
 * Fixed bottom tab bar, phones only.
 *
 * Fixed rather than sticky so it behaves like an app tab bar, with padding
 * reserved on the page so the last row is never hidden behind it.
 *
 * Rendered here rather than in site-chrome.tsx so it shares this file's
 * `isActive` and its tab list. Both are cheap; duplicating them is how the two
 * navigation sets drifted apart the first time.
 */
export function MobileTabBarClient({ path }: { path: string }) {
  const TABS = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/search", label: "Search", icon: "search" },
    { href: "/services", label: "Services", icon: "grid" },
    { href: "/bookings", label: "Bookings", icon: "calendar" },
    { href: "/account", label: "Account", icon: "user" },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-30 border-t border-ink-300/50 md:hidden"
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
                className={`press flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-200 ${
                  active ? "text-brand-300" : "text-ink-500"
                }`}
              >
                {/*
                  The active pip. Sits behind the icon and is the only thing
                  that moves between tabs, which is what makes the bar feel like
                  a single object changing state rather than five items each
                  blinking.
                */}
                <span className="relative grid place-items-center">
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 h-1 w-1 rounded-full bg-brand-400"
                    />
                  ) : null}
                  <TabIcon name={tab.icon} className="h-5 w-5" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
