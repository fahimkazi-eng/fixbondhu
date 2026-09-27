import { NextResponse, type NextRequest } from "next/server";

/**
 * One deployment, three platforms.
 *
 * fixbondhu.com, pro.fixbondhu.com and admin.fixbondhu.com are rewritten onto
 * /, /pro and /admin respectively, so each surface has its own layout, design
 * and navigation while sharing one build, one env set and one type surface.
 *
 * These three route groups are a routing convenience, NOT a security boundary.
 * The real boundary is server-side: every admin route calls requireStaff and
 * every provider route checks ownership of the record being touched. A rewrite
 * only decides which React tree renders; it grants nothing. That matters,
 * because a visitor can always type fixbondhu.com/admin/bookings directly.
 *
 * In production the /pro and /admin path prefixes are disabled so the only way
 * to reach those surfaces is the correct hostname. Locally they are enabled
 * because a single localhost:3000 cannot present three hostnames.
 */

const PROVIDER_PREFIX = "/pro";
const ADMIN_PREFIX = "/admin";

type Surface = "customer" | "provider" | "admin";

function surfaceFromHost(host: string): Surface | null {
  // Strip the port before testing, so localhost:3000 does not read as a host.
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  if (hostname === "pro" || hostname.startsWith("pro.")) return "provider";
  if (hostname === "admin" || hostname.startsWith("admin.")) return "admin";
  if (hostname === "www" || hostname.startsWith("www.")) return "customer";
  return null;
}

/**
 * Next 16 renamed this convention from "middleware" to "proxy". The behaviour
 * is identical: this runs before every matched route and may rewrite the
 * request. Kept as a single file so the three-platform routing rule is
 * auditable in one place.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  const surface = surfaceFromHost(host);
  if (surface === null) {
    return NextResponse.next();
  }

  // Already inside a surface route group, or hitting a platform-level asset.
  if (
    pathname.startsWith(`${PROVIDER_PREFIX}/`) ||
    pathname.startsWith(`${ADMIN_PREFIX}/`) ||
    pathname === PROVIDER_PREFIX ||
    pathname === ADMIN_PREFIX
  ) {
    return NextResponse.next();
  }

  const prefix = surface === "provider" ? PROVIDER_PREFIX : ADMIN_PREFIX;

  // Public platform assets stay at the root so all three surfaces can reference
  // the same font and icon files without duplicating them.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? prefix : `${prefix}${pathname}`;
  url.search = search;

  const response = NextResponse.rewrite(url);

  // Lets server components read the surface without re-parsing the hostname,
  // and lets layout pick the right shell.
  response.headers.set("x-fixbondhu-surface", surface);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and files with an extension. Extension
     * filtering matters: rewriting /manifest.json or /sw.js would break the PWA,
     * and those are served from the root on every surface.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
