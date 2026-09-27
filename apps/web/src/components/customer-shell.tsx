import Link from "next/link";

/** Customer shell. Header plus the account sections, mobile-friendly. */
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
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white"
            >
              F
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
              FixBondhu
            </span>
          </Link>

          <form action="/search" method="get" className="hidden flex-1 gap-2 md:flex">
            <label className="sr-only" htmlFor="q">
              Search services
            </label>
            <input
              className="input h-9 text-sm"
              id="q"
              name="q"
              type="search"
              placeholder="AC repair, plumber, গিজার"
            />
            <button className="btn btn-secondary h-9" type="submit">
              Search
            </button>
          </form>

          <nav className="flex shrink-0 items-center gap-1">
            {signedInName ? (
              <span className="hidden text-sm text-ink-600 lg:inline">{signedInName}</span>
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
            is hidden behind a menu nobody opens. */}
        <nav aria-label="Account sections" className="border-t border-ink-100">
          <ul className="container-page flex gap-1 overflow-x-auto py-1.5 text-sm">
            {links.map((link) => {
              const active =
                link.href === "/account" ? path === "/account" : path.startsWith(link.href);
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors ${
                      active ? "bg-brand-50 font-medium text-brand-800" : "text-ink-600 hover:bg-ink-100"
                    }`}
                  >
                    {link.label}
                    {link.count ? (
                      <span className="animate-pop rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
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

      <main id="main" className="container-page py-6">
        {children}
      </main>
    </div>
  );
}
