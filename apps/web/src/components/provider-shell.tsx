import Link from "next/link";

import { SurfaceNav, type NavGroup } from "./surface-nav";

/** Bell with a live unread count. Pure presentational, no client JS needed. */
export function BellRing({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M10 2a5 5 0 00-5 5v3.6l-1.4 2.8A.9.9 0 004.5 15h11a.9.9 0 00.85-1.2L15 10.6V7a5 5 0 00-5-5zM8 16a2 2 0 004 0H8z" />
    </svg>
  );
}

/** Provider shell. Sidebar on desktop, scrollable bar on mobile. */
export function ProviderShell({
  groups,
  current,
  unreadCount,
  children,
}: {
  groups: NavGroup[];
  current: string;
  unreadCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/pro" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-sm font-bold text-white"
            >
              F
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              FixBondhu <span className="font-normal text-ink-500">Pro</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className="hidden btn btn-secondary sm:inline-flex">
              Operations
            </Link>
            <Link href="/" className="hidden btn btn-secondary sm:inline-flex">
              Customer site
            </Link>
            <Link href="/pro/settings" className="btn btn-secondary">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <div className="container-page flex gap-6 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <SurfaceNav groups={groups} current={current} unreadCount={unreadCount} homeHref="/pro" brandLabel="Provider" />
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {/* Mobile: the same menu as a horizontal scroller, so no item is
          unreachable on a small screen. */}
      <nav
        aria-label="Provider sections"
        className="sticky bottom-0 z-20 border-t border-ink-200 bg-white lg:hidden"
      >
        <ul className="container-page flex gap-1 overflow-x-auto py-2 text-sm">
          {[{ href: "/pro", label: "Overview" }, ...groups.flatMap((g) => g.items)].map(
            (item) => {
              const active =
                item.href === "/pro" ? current === "/pro" : current.startsWith(item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors ${
                      active ? "bg-brand-50 font-medium text-brand-800" : "text-ink-600"
                    }`}
                  >
                    {item.short ?? item.label}
                    {item.count ? (
                      <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                        {item.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            },
          )}
        </ul>
      </nav>
    </div>
  );
}

