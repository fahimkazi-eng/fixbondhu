import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FixBondhu Operations",
  robots: { index: false, follow: false },
};

/**
 * Admin chrome.
 *
 * Navigation lists the areas that exist. Every data page behind these links
 * calls requireStaff() on the server, so hiding an item here is presentation
 * only, never the control. Role-specific limits are enforced per permission
 * inside each page, because a SUPPORT agent must not be able to reach
 * /admin/finance by typing the URL.
 */
const SECTIONS = [
  { href: "/admin", label: "Operations" },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/complaints", label: "Complaints" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-100">
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-sm font-bold text-white"
            >
              F
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              FixBondhu <span className="font-normal text-ink-500">Operations</span>
            </span>
          </Link>
          <Link href="/" className="text-xs text-ink-600 hover:text-ink-900">
            Customer site
          </Link>
        </div>
      </header>

      <div className="container-page py-6">
        <nav className="mb-6 flex flex-wrap gap-1" aria-label="Admin sections">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-900"
            >
              {section.label}
            </Link>
          ))}
        </nav>
        <main id="main">{children}</main>
      </div>
    </div>
  );
}
