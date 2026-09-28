import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Reviews.
 *
 * Only reviews attached to a completed booking exist, and the rating shown is
 * the average of exactly those rows rather than a stored counter that could
 * drift away from them.
 */
export default async function ProviderReviewsPage() {
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/services");

  const [reviews, stats, distribution] = await Promise.all([
    prisma.review.findMany({
      where: { providerProfileId: user.providerProfileId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: { select: { name: true } },
        booking: { select: { serviceNameEn: true, reference: true } },
      },
    }),
    prisma.review.aggregate({
      where: { providerProfileId: user.providerProfileId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { providerProfileId: user.providerProfileId, status: "PUBLISHED" },
      _count: true,
    }),
  ]);

  const total = stats._count;
  const counts = new Map(distribution.map((d) => [d.rating, d._count]));

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Reviews</h1>

      {total === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No reviews yet. Customers can only review a job they actually had
          completed, so reviews appear here as real work is finished.
        </p>
      ) : (
        <>
          <section className="card mt-4 p-5">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink-900">
                  {(stats._avg.rating ?? 0).toFixed(1)}
                </p>
                <p className="text-xs text-ink-500">out of 5</p>
              </div>
              <ul className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = counts.get(star) ?? 0;
                  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <li key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-8 shrink-0 tabular-nums text-ink-600">{star}★</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <span
                          className="block h-full rounded-full bg-brand-600 transition-[width] duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums text-ink-500">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <ul className="stagger mt-4 space-y-2">
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
                      {review.booking.serviceNameEn} ·{" "}
                      {new Date(review.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="chip tabular-nums">{review.rating}/5</span>
                </div>
                {review.title ? (
                  <p className="mt-2 text-sm font-medium text-ink-800">{review.title}</p>
                ) : null}
                <p className="mt-1 text-sm leading-relaxed text-ink-700">{review.body}</p>
                {review.providerReply ? (
                  <p className="mt-2 border-l-2 border-ink-200 pl-3 text-sm text-ink-600">
                    <span className="font-medium">Your reply:</span> {review.providerReply}
                  </p>
                ) : null}
                <Link
                  href={`/pro/bookings/${review.bookingId}`}
                  className="mt-2 inline-block text-xs text-brand-300 underline"
                >
                  View job {review.booking.reference}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
