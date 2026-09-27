"use client";

import Link from "next/link";

import { Inbox } from "./icons";

/**
 * Surface navigation.
 *
 * A single source of truth for a platform's menu, so the sidebar, the mobile
 * drawer and any future command palette cannot drift out of sync.
 *
 * Highlighting uses exact match for "/" and prefix match elsewhere, so a page
 * like /pro/bookings/abc does not light up both "Bookings" and "Requests".
 */
export interface NavItem {
  href: string;
  label: string;
  /** Rendered as a count badge when supplied. */
  count?: number;
  /** Short label for the mobile bar where space is tight. */
  short?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export function SurfaceNav({
  groups,
  current,
  homeHref,
  brandLabel,
  homeLabel = "Overview",
  unreadCount,
}: {
  groups: NavGroup[];
  current: string;
  homeHref: string;
  brandLabel: string;
  homeLabel?: string;
  unreadCount?: number;
}) {
  const items: NavItem[] = [{ href: homeHref, label: homeLabel }, ...groups.flatMap((g) => g.items)];

  return (
    <nav aria-label={`${brandLabel} navigation`} className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(current, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
                      active
                        ? "bg-brand-50 font-medium text-brand-800"
                        : "text-ink-700 hover:bg-ink-100"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.count ? (
                      <span className="animate-pop shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="border-t border-ink-200 pt-4">
        <Link
          href={items[items.length - 1]?.href ?? homeHref}
          className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-ink-700 transition-colors duration-150 hover:bg-ink-100"
        >
          <span className="inline-flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Notifications
          </span>
          {unreadCount ? (
            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>
    </nav>
  );
}

function isActive(current: string, href: string): boolean {
  if (href === "/") return current === "/";
  if (current === href) return true;
  // A section is active when a deeper page is open, but only at a path
  // boundary, so /pro/requests does not match /pro/request-archive.
  return current.startsWith(`${href}/`);
}
