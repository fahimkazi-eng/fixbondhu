import Link from "next/link";
import type { Metadata } from "next";

import { Prisma } from "@fixbondhu/db";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Reviews moderation", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Review moderation.
 *
 * Every review here is attached to a real completed booking by database
 * constraint, so there is no question of invented feedback. What support needs
 * is the subset that customers or providers have flagged, and the ability to
 * hide something that breaks the rules.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireStaff("review:moderate");
  const { filter } = await searchParams;

  const where: Prisma.ReviewWhereInput =
    filter === "flagged"
      ? { flags: { some: { resolvedAt: null } } }
      : filter === "hidden"
        ? { status: { in: ["HIDDEN", "REMOVED"] as const } }
        : {};

  const [reviews, flaggedCount, hiddenCount] = await Promise.all([
    prisma.review.findMany({
      where: { ...where },
      orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        customer: { select: { name: true } },
        providerProfile: { select: { displayName: true, slug: true } },
        booking: { select: { reference: true, serviceNameEn: true } },
        flags: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
    prisma.review.count({ where: { flags: { some: { resolvedAt: null } } } }),
    prisma.review.count({ where: { status: { in: ["HIDDEN", "REMOVED"] } } }),
  ]);

  const tabs = [
    { key: "", label: "All" },
    { key: "flagged", label: "Flagged", count: flaggedCount },
    { key: "hidden", label: "Hidden", count: hiddenCount },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Reviews</h1>
      <p className="mt-1.5 text-sm text-ink-600">
        Every review is tied to a completed booking, so ratings cannot be invented.
        Moderation here is about content, not authenticity.
      </p>

      <nav className="mt-4 flex flex-wrap gap-1" aria-label="Filter reviews">
        {tabs.map((tab) => {
          const active = (filter ?? "") === tab.key;
          return (
            <a
              key={tab.key || "all"}
              href={tab.key ? `/admin/reviews?filter=${tab.key}` : "/admin/reviews"}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                active
                  ? "tone-accent"
                  : "border-ink-300 bg-ink-100 text-ink-600"
              }`}
            >
              {tab.label}
              {tab.count ? (
                <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[11px] text-ink-50">
                  {tab.count}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      {reviews.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No reviews match.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-3">
          {reviews.map((review, index) => (
            <li
              key={review.id}
              className="card animate-rise p-4"
              style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink-900">{review.customer.name}</p>
                  <p className="text-xs text-ink-500">
                    on{" "}
                    <Link
                      href={`/providers/${review.providerProfile.slug}`}
                      className="text-brand-300 underline"
                    >
                      {review.providerProfile.displayName}
                    </Link>{" "}
                    · {review.booking.serviceNameEn} · {review.booking.reference}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip tabular-nums">{review.rating}/5</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      review.status === "PUBLISHED"
                        ? "tone-success"
                        : "border-ink-200 bg-ink-50 text-ink-600"
                    }`}
                  >
                    {review.status.toLowerCase()}
                  </span>
                </div>
              </div>

              {review.title ? (
                <p className="mt-2 text-sm font-medium text-ink-800">{review.title}</p>
              ) : null}
              <p className="mt-1 text-sm leading-relaxed text-ink-700">{review.body}</p>

              {review.flags.length > 0 ? (
                <div className="mt-3 rounded-md tone-warning p-2.5">
                  <p className="text-xs font-medium text-amber-900">
                    {review.reportCount} report{review.reportCount === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {review.flags.map((flag) => (
                      <li key={flag.id} className="text-xs text-amber-900">
                        {flag.reason}
                        {flag.detail ? ` — ${flag.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
