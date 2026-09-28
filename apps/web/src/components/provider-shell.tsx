import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
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
    <div className="flex min-h-dvh flex-col bg-ink-50">
      {/* Static glass, same reasoning as CustomerShell: no scroll listener, so
          no compacting, which keeps this a server component. */}
      <header className="glass sticky top-0 z-20 border-b border-ink-300/50">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/pro" className="press flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
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

      <div className="container-page flex flex-1 gap-6 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          {/* top-20 clears the h-14 header. Not top-14, because a sticky sidebar
              whose first row sits flush under a blurred header reads as clipped. */}
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
        className="glass sticky bottom-0 z-20 border-t border-ink-300/50 lg:hidden"
      >
        <ul className="container-page scrollbar-none flex gap-1 overflow-x-auto py-2 text-sm">
          {[{ href: "/pro", label: "Overview" }, ...groups.flatMap((g) => g.items)].map(
            (item) => {
              const active =
                item.href === "/pro" ? current === "/pro" : current.startsWith(item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors duration-200 ${
                      active ? "bg-brand-500/15 font-medium text-brand-200" : "text-ink-600"
                    }`}
                  >
                    {item.short ?? item.label}
                    {item.count ? (
                      <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-ink-50 tabular-nums">
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

