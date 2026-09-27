import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Customer overview.
 *
 * Every count is a live query and every money figure sums captured payments
 * only. A new account shows zeros, which is the truth rather than a placeholder.
 */
export default async function AccountPage() {
  const user = await requireUser("/account");

  const [upcoming, totalBookings, addresses, reviews, spent, lastBooking, saved] =
    await Promise.all([
      prisma.booking.count({
        where: {
          customerId: user.id,
          status: { in: ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] },
        },
      }),
      prisma.booking.count({ where: { customerId: user.id } }),
      prisma.address.count({ where: { userId: user.id, deletedAt: null } }),
      prisma.review.count({ where: { customerId: user.id } }),
      prisma.payment.aggregate({
        where: { customerId: user.id, status: "CAPTURED" },
        _sum: { amountPoisha: true },
        _count: true,
      }),
      prisma.booking.findFirst({
        where: { customerId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          serviceNameEn: true,
          status: true,
          scheduledAt: true,
          providerProfile: { select: { displayName: true } },
        },
      }),
      prisma.savedProvider.count({ where: { userId: user.id } }),
    ]);

  const cards = [
    { label: "In progress", value: upcoming, href: "/bookings", emphasis: upcoming > 0 },
    { label: "All bookings", value: totalBookings, href: "/bookings" },
    { label: "Addresses", value: addresses, href: "/account/addresses" },
    { label: "Reviews", value: reviews, href: "/account/reviews" },
    { label: "Saved providers", value: saved, href: "/account/saved" },
    {
      label: "Spent",
      value: formatPoisha(spent._sum.amountPoisha ?? 0),
      sub: `${spent._count} paid`,
      href: "/account/payments",
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight text-ink-900">{user.name}</h1>
      <p className="mt-1 text-sm text-ink-600">{user.phone}</p>

      {!user.phoneVerified ? (
        <p className="mt-3 rounded-md border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600">
          This account is not phone-verified. Verification is not required to book
          right now, and nothing on this page claims otherwise.
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card interactive p-4">
            <dt className="text-xs text-ink-500">{card.label}</dt>
            <dd
              className={`mt-0.5 text-lg font-semibold tabular-nums tracking-tight ${
                card.emphasis ? "text-brand-700" : "text-ink-900"
              }`}
            >
              {card.value}
            </dd>
            {card.sub ? <p className="text-xs text-ink-500">{card.sub}</p> : null}
          </Link>
        ))}
      </dl>

      {lastBooking ? (
        <section className="card mt-5 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Most recent booking</h2>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-medium text-ink-900">
                {lastBooking.serviceNameEn}
              </p>
              <p className="text-sm text-ink-600">
                {lastBooking.providerProfile.displayName}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {new Date(lastBooking.scheduledAt).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Link href={`/bookings/${lastBooking.id}`} className="btn btn-secondary">
              Open
            </Link>
          </div>
        </section>
      ) : (
        <section className="card mt-5 p-8 text-center">
          <h2 className="text-[15px] font-medium text-ink-900">No bookings yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-600">
            Search for a service and request a provider. You will see the exact
            price before anything is agreed.
          </p>
          <Link href="/search" className="btn btn-primary mt-4">
            Find a service
          </Link>
        </section>
      )}
    </div>
  );
}
