import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

/**
 * Customer shell. Header plus the account sections, mobile-friendly.
 *
 * On the glass treatment: this header uses the STATIC .glass class rather than
 * the scroll-compacting .header-shell that the public header uses. That is a
 * deliberate difference, not an oversight. The compacting version needs a scroll
 * listener, which means a client component, which means the account header
 * becomes a client boundary on every page under it. The public header earns that
 * cost because it is the first thing every visitor sees; the account header is
 * seen by people who arrived with a task in mind, where a stable surface beats a
 * clever one.
 */
export function CustomerShell({
  unread,
  messageUnread,
  path,
  signedInName,
  children,
}: {
  unread: number;
  messageUnread: number;
  path: string;
  signedInName: string | null;
  children: React.ReactNode;
}) {
  const links = [
    { href: "/account", label: "Overview" },
    { href: "/bookings", label: "Bookings" },
    { href: "/messages", label: "Messages", count: messageUnread },
    { href: "/notifications", label: "Notifications", count: unread },
    { href: "/account/addresses", label: "Addresses" },
    { href: "/account/reviews", label: "Reviews" },
    { href: "/support", label: "Support" },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <header className="glass sticky top-0 z-20 border-b border-ink-300/50">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link href="/" className="press flex shrink-0 items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
              FixBondhu
            </span>
          </Link>

          <form action="/search" method="get" className="hidden flex-1 justify-center md:flex">
            <div className="relative w-full max-w-md">
              <label className="sr-only" htmlFor="q">
                Search services
              </label>
              <input
                className="input focus-expand h-9 pl-9 text-sm"
                id="q"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="AC repair, plumber, গিজার"
              />
              {/* The icon sits inside the field rather than in a button beside
                  it. The public header does the same, and the two are meant to
                  look like one product. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                >
                  <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
                </svg>
              </span>
            </div>
          </form>

          <nav className="flex shrink-0 items-center gap-1">
            {signedInName ? (
              <span className="hidden max-w-[10rem] truncate text-sm text-ink-500 lg:inline">
                {signedInName}
              </span>
            ) : null}
            <Link href="/search" className="btn btn-secondary md:hidden">
              Search
            </Link>
            <Link href="/account" className="btn btn-primary">
              Account
            </Link>
          </nav>
        </div>

        {/* Account sections. A single row that scrolls on a phone, so nothing
            is hidden behind a menu nobody opens. The scrollbar is hidden rather
            than styled, because a visible 8px bar under a row of pills is
            chrome competing with the pills. */}
        <nav aria-label="Account sections" className="border-t border-ink-300/40">
          <ul className="container-page scrollbar-none flex gap-1 overflow-x-auto py-1.5 text-sm">
            {links.map((link) => {
              const active =
                link.href === "/account" ? path === "/account" : path.startsWith(link.href);
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors duration-200 ${
                      active
                        ? "bg-brand-500/15 font-medium text-brand-200"
                        : "text-ink-600 hover:bg-ink-300/40 hover:text-ink-900"
                    }`}
                  >
                    {link.label}
                    {link.count ? (
                      <span className="animate-pop rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-ink-50 tabular-nums">
                        {link.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main" className="container-page flex-1 py-6">
        {children}
      </main>
    </div>
  );
}
