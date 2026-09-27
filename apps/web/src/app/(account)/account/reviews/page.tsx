import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Your reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CustomerReviewsPage() {
  const user = await requireUser("/account/reviews");

  const reviews = await prisma.review.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      providerProfile: { select: { displayName: true, slug: true } },
      booking: { select: { id: true, reference: true, serviceNameEn: true } },
    },
  });

  // Bookings eligible for a review but not yet reviewed.
  const reviewable = await prisma.booking.findMany({
    where: { customerId: user.id, status: "COMPLETED", review: null },
    orderBy: { completedAt: "desc" },
    take: 20,
    include: { providerProfile: { select: { displayName: true } } },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Your reviews</h1>

      {reviewable.length > 0 ? (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-ink-900">Waiting for your review</h2>
          <ul className="mt-2 space-y-2">
            {reviewable.map((booking) => (
              <li
                key={booking.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-[15px] font-medium text-ink-900">
                    {booking.serviceNameEn}
                  </p>
                  <p className="text-xs text-ink-500">
                    {booking.providerProfile.displayName} · completed{" "}
                    {booking.completedAt
                      ? new Date(booking.completedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      : "recently"}
                  </p>
                </div>
                <Link href={`/bookings/${booking.id}`} className="btn btn-primary">
                  Write a review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">
          Reviews you have left ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-ink-600">
            You have not left any reviews. You can review a job once it is
            completed, and each job can be reviewed once.
          </p>
        ) : (
          <ul className="stagger mt-2 space-y-2">
            {reviews.map((review, index) => (
              <li
                key={review.id}
                className="card animate-rise p-4"
                style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/providers/${review.providerProfile.slug}`}
                      className="text-sm font-medium text-ink-900 hover:underline"
                    >
                      {review.providerProfile.displayName}
                    </Link>
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
                    <span className="font-medium">
                      {review.providerProfile.displayName} replied:
                    </span>{" "}
                    {review.providerReply}
                  </p>
                ) : null}

                {review.status !== "PUBLISHED" ? (
                  <p className="mt-2 text-xs text-amber-700">
                    This review is {review.status.toLowerCase()} by a moderator and is
                    not shown publicly.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
