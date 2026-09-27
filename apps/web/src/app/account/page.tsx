import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Customer account.
 *
 * requireUser() runs on the server, so this is unreachable without a valid,
 * unrevoked session. Every count is a live query; an account created a minute
 * ago shows zeros rather than placeholders.
 */
export default async function AccountPage() {
  const user = await requireUser("/account");

  const [bookings, addresses, reviews, upcoming] = await Promise.all([
    prisma.booking.count({ where: { customerId: user.id } }),
    prisma.address.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.review.count({ where: { customerId: user.id } }),
    prisma.booking.count({
      where: {
        customerId: user.id,
        status: { in: ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] },
      },
    }),
  ]);

  return (
    <>
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white"
            >
              F
            </span>
            <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main id="main" className="container-page py-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          {user.name}
        </h1>
        <p className="mt-1 text-sm text-ink-600">{user.phone}</p>

        {/*
          Stated plainly rather than hidden. The account is unverified and the
          product must not imply otherwise, and pretending it is not required
          would be equally dishonest if it later becomes a booking requirement.
        */}
        {!user.phoneVerified ? (
          <p className="mt-3 rounded-md border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600">
            This account is not phone-verified. Booking and payment are not
            available until verification is added.
          </p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Bookings" value={bookings} />
          <Metric label="In progress" value={upcoming} emphasis={upcoming > 0} />
          <Metric label="Addresses" value={addresses} />
          <Metric label="Reviews" value={reviews} />
        </dl>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink-900">Coming next</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Your account is ready. Booking, messaging and payment are not built
            yet, so there is nothing to show here rather than an empty screen
            pretending otherwise.
          </p>
        </section>
      </main>
    </>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className={`card px-4 py-3 ${emphasis ? "border-brand-600" : ""}`}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink-900">
        {value}
      </dd>
    </div>
  );
}
