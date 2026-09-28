import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { MobileTabBarClient, SiteHeaderClient } from "@/components/site-header-client";

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
 *
 * Both interactive pieces live in site-header-client.tsx because they need the
 * scroll position. This module stays a server module, so pages can import the
 * header without pulling a client boundary across their own data fetching.
 */

/** Re-exported rather than reimplemented, so the four call sites are unchanged. */
export function SiteHeader(props: {
  path: string;
  signedInName: string | null;
  areaName: string | null;
}) {
  return <SiteHeaderClient {...props} />;
}

export function MobileTabBar({ path }: { path: string }) {
  return <MobileTabBarClient path={path} />;
}

/** Reserves room for the fixed tab bar so content is never trapped under it. */
export function TabBarSpacer() {
  return <div aria-hidden className="h-16 md:hidden" />;
}

export function SiteFooter() {
  return (
    <footer className="relative mt-auto border-t border-ink-300/60 bg-ink-100/30">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:gap-6">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">
              FixBondhu
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            Local services, properly verified. Every professional on FixBondhu
            has had their identity and trade checked by an administrator before
            they can take a booking.
          </p>
        </div>

        <FooterColumn
          title="Marketplace"
          links={[
            { href: "/services", label: "All services" },
            { href: "/providers", label: "Find a professional" },
            { href: "/search", label: "Search" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { href: "/bookings", label: "Your bookings" },
            { href: "/account", label: "Sign in" },
            { href: "/support", label: "Support" },
          ]}
        />
      </div>

      <div className="border-t border-ink-300/40">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>FixBondhu — local services, properly verified.</p>
          {/*
            Deliberately plain. There is no fabricated trust badge row, no
            invented "10,000+ happy customers" and no partner logos; anything
            like that would be a number this product cannot substantiate.
          */}
          <p>Prices, ratings and counts on this site are read live from the database.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="link-underline text-sm text-ink-500 transition-colors duration-200 hover:text-ink-900"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
