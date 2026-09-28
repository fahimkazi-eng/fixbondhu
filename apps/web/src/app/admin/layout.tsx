import Link from "next/link";
import type { Metadata } from "next";

import { BrandMark } from "@/components/brand-mark";
import { SurfaceNav } from "@/components/surface-nav";
import { adminNav } from "@/lib/admin-nav";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "FixBondhu Operations", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Admin layout.
 *
 * Chrome only. The menu lists what exists, but every page behind it calls
 * requireStaff() and checks a specific permission, because a SUPPORT agent
 * legitimately sees this navigation while still being refused /admin/payouts.
 * Hiding a link is presentation, never the control.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { groups, unread } = await adminNav();
  const h = await headers();
  const current = h.get("x-next-url") ?? h.get("x-invoke-path") ?? "/admin";

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      {/* Static glass rather than the scroll-compacting .header-shell: this
          layout stays a server component, and a table-heavy tool surface is not
          where a shrinking bar earns its cost. */}
      <header className="glass sticky top-0 z-20 border-b border-ink-300/50">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/admin" className="press flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">
              FixBondhu <span className="font-normal text-ink-500">Operations</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/pro" className="hidden btn btn-secondary sm:inline-flex">
              Provider view
            </Link>
            <Link href="/" className="btn btn-secondary">Customer site</Link>
          </nav>
        </div>
      </header>

      <div className="container-page flex flex-1 gap-6 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20">
            <SurfaceNav
              groups={groups}
              current={current}
              homeHref="/admin"
              homeLabel="Overview"
              brandLabel="Admin"
              unreadCount={unread}
            />
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <nav
        aria-label="Admin sections"
        className="glass sticky bottom-0 z-20 border-t border-ink-300/50 lg:hidden"
      >
        <ul className="container-page scrollbar-none flex gap-1 overflow-x-auto py-2 text-sm">
          {groups.flatMap((g) => g.items).map((item) => {
            const active = current.startsWith(item.href);
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
          })}
        </ul>
      </nav>
    </div>
  );
}
