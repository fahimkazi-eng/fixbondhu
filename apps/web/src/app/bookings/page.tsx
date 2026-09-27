import Link from "next/link";
import type { Metadata } from "next";

import { STATUS_LABELS, STATUS_TONE } from "@fixbondhu/core";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE_CLASSES: Record<string, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  progress: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

export default async function BookingsPage() {
  const user = await requireUser("/bookings");

  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      additionalCharges: { where: { status: "PENDING" }, select: { id: true, amountPoisha: true } },
    },
  });

  return (
    <>
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white">F</span>
            <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/account" className="btn btn-secondary">Account</Link>
            <Link href="/bookings" className="btn btn-secondary">Bookings</Link>
            <Link href="/search" className="btn btn-primary">Find a service</Link>
          </nav>
        </div>
      </header>

      <main id="main" className="container-page py-6">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">My bookings</h1>

        {bookings.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <h2 className="text-[15px] font-medium text-ink-900">No bookings yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-600">
              When you request a service it will appear here, with live status from
              the moment the provider responds.
            </p>
            <Link href="/search" className="btn btn-primary mt-4">
              Find a service
            </Link>
          </div>
        ) : (
          <ul className="stagger mt-4 space-y-2">
            {bookings.map((booking, index) => (
              <li key={booking.id} style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
                <Link
                  href={`/bookings/${booking.id}`}
                  className="card interactive block p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-medium text-ink-900">
                          {booking.serviceNameEn}
                        </p>
                        <span
                          className={`animate-fade-in rounded-full border px-2 py-0.5 text-xs ${
                            TONE_CLASSES[STATUS_TONE[booking.status]]
                          }`}
                        >
                          {STATUS_LABELS[booking.status].en}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-600">
                        {booking.providerName} · {booking.areaName}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {booking.reference} ·{" "}
                        {new Date(booking.scheduledAt).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums text-ink-900">
                        ৳{(booking.totalPoisha / 100).toLocaleString("en-US")}
                      </p>
                      {booking.additionalCharges.length > 0 ? (
                        <p className="mt-1 animate-pulse text-xs font-medium text-amber-700">
                          Charge awaiting your approval
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
