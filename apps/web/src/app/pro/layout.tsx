import Link from "next/link";
import type { Metadata } from "next";

import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Provider dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Provider shell.
 *
 * Route protection happens in the pages and actions that touch data; this
 * layout only establishes chrome. Middleware rewrites pro.fixbondhu.com here,
 * but that rewrite grants nothing on its own.
 */
export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
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
            {user ? (
              <span className="hidden text-ink-600 sm:inline">{user.name}</span>
            ) : null}
            <Link href="/login" className="btn btn-secondary">
              {user ? "Switch account" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="container-page py-8">
        {children}
      </main>
    </div>
  );
}
