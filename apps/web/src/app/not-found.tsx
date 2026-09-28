import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

/**
 * The global 404.
 *
 * Deliberately self-contained: it renders its own minimal header rather than
 * importing SiteHeader, because this file is the root boundary and it has to be
 * correct for all three surfaces the proxy can serve — the marketplace, /pro and
 * /admin. A not-found page that assumes it is on the public site would put a
 * marketplace nav bar above a customer who is actually signed in to the admin.
 *
 * It also says what actually went wrong instead of "Something went wrong". On a
 * product where a customer has just tapped a shared booking link, the most
 * useful thing the page can do is distinguish "this link is dead" from "this
 * page is broken".
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink-300/50">
        <div className="container-page flex h-14 items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">
            FixBondhu
          </span>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center py-20">
        <div className="container-page">
          <div className="max-w-xl">
            <p className="eyebrow">Error 404</p>
            <h1 className="display mt-4 text-[clamp(2rem,6vw,3.25rem)] text-ink-900">
              This link does not lead anywhere.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-600">
              The page you asked for is not here. That is usually one of three
              things: the link was typed or shortened wrongly, the listing it
              pointed at has been removed by the professional who owns it, or the
              service has been retired.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <Link href="/" className="btn btn-primary">
                Back to home
              </Link>
              <Link href="/search" className="btn btn-secondary">
                Search services
              </Link>
            </div>

            <p className="mt-8 text-sm text-ink-500">
              If you followed a link from a real FixBondhu booking, the booking
              is still safe — open{" "}
              <Link
                href="/bookings"
                className="link-underline text-brand-300"
              >
                your bookings
              </Link>{" "}
              and it will be there.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
