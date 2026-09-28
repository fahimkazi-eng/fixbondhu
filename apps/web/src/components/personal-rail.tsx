import Link from "next/link";

import { formatPoisha } from "@fixbondhu/core";

import { getPastBookings, getRecommendedServices } from "@/lib/recommendations";

/**
 * "Book again" and "Recommended for you".
 *
 * Both are driven by real Booking rows and both render nothing when there is no
 * history. A new customer sees neither section rather than a popularity list
 * wearing the label, because a rail called "for you" that is not about you
 * teaches people to stop reading the labels.
 */
export async function PersonalRail({ customerId }: { customerId: string }) {
  const [past, recommended] = await Promise.all([
    getPastBookings(customerId, 4),
    getRecommendedServices(customerId, 4),
  ]);

  if (past.length === 0 && recommended.length === 0) return null;

  return (
    <>
      {past.length > 0 ? (
        <section aria-labelledby="book-again" className="container-page pt-8">
          <h2
            id="book-again"
            className="text-base font-semibold tracking-tight text-ink-900"
          >
            Book again
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            From your booking history. Prices shown are that provider&apos;s current
            price, not the one you paid.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {past.map((booking) => (
              <li key={booking.bookingId}>
                <div className="card flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {booking.serviceNameEn}
                      </p>
                      <p className="truncate text-xs text-ink-600">
                        {booking.providerName}
                      </p>
                    </div>
                    <span className="chip shrink-0 text-ink-600">
                      {STATUS_LABEL[booking.status] ?? booking.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-ink-500">
                    {booking.scheduledAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>

                  <div className="mt-auto pt-3">
                    {/*
                      Re-booking is only offered when it can actually work: the
                      provider must still be active and still offer that service.
                      Otherwise it links to the profile so the customer can pick
                      something current instead of a dead form.
                    */}
                    {booking.rebookable ? (
                      <Link
                        href={`/providers/${booking.providerSlug}#book`}
                        className="btn btn-primary w-full py-1.5 text-xs"
                      >
                        Book again
                      </Link>
                    ) : (
                      <Link
                        href={`/providers/${booking.providerSlug}`}
                        className="btn btn-secondary w-full py-1.5 text-xs"
                      >
                        View profile
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recommended.length > 0 ? (
        <section aria-labelledby="recommended" className="container-page pt-8">
          <h2
            id="recommended"
            className="text-base font-semibold tracking-tight text-ink-900"
          >
            Recommended for you
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Related to{" "}
            {[...new Set(recommended.map((r) => r.reasonCategory))].join(", ")} — the
            {recommended.length === 1 ? " category " : " categories "}
            you have booked in before.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((service, i) => (
              <li
                key={service.slug}
                className="animate-rise"
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
              >
                <Link
                  href={`/services/${service.slug}`}
                  className="card interactive flex h-full flex-col p-4"
                >
                  <span className="text-sm font-medium text-ink-900">
                    {service.nameEn}
                  </span>
                  <span lang="bn" className="mt-0.5 text-sm text-ink-600">
                    {service.nameBn}
                  </span>
                  <span className="mt-auto pt-3 text-xs tabular-nums text-ink-500">
                    {service.providerCount}{" "}
                    {service.providerCount === 1 ? "professional" : "professionals"}
                    {service.fromPricePoisha !== null
                      ? ` · from ${formatPoisha(service.fromPricePoisha)}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};
