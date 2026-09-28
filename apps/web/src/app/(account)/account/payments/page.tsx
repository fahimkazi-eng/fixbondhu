import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Payment history", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CustomerPaymentsPage() {
  const user = await requireUser("/account/payments");

  const [payments, totals] = await Promise.all([
    prisma.payment.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        booking: { select: { id: true, reference: true, serviceNameEn: true } },
        providerProfile: { select: { displayName: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { customerId: user.id, status: "CAPTURED" },
      _sum: { amountPoisha: true },
      _count: true,
    }),
  ]);

  const refunded = payments.reduce((sum, p) => sum + p.refundedPoisha, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Payment history
      </h1>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <dt className="text-xs text-ink-500">Total paid</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            {formatPoisha(totals._sum.amountPoisha ?? 0)}
          </dd>
          <p className="text-xs text-ink-500">{totals._count} payments</p>
        </div>
        <div className="card px-4 py-3">
          <dt className="text-xs text-ink-500">Refunded</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            {formatPoisha(refunded)}
          </dd>
        </div>
        <div className="card px-4 py-3">
          <dt className="text-xs text-ink-500">Net</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            {formatPoisha((totals._sum.amountPoisha ?? 0) - refunded)}
          </dd>
        </div>
      </dl>

      {payments.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No payments yet. They appear here once a booking is paid.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="card animate-rise p-4"
              style={{ "--i": Math.min(index(payments, payment), 8) } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/bookings/${payment.booking.id}`}
                    className="text-[15px] font-medium text-ink-900 hover:underline"
                  >
                    {payment.booking.serviceNameEn}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {payment.booking.reference} · {payment.providerProfile.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {payment.method === "CASH" ? "Cash on site" : payment.method} ·{" "}
                    {new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-ink-900">
                    {formatPoisha(payment.amountPoisha)}
                  </p>
                  {payment.refundedPoisha > 0 ? (
                    <p className="text-xs text-red-600">
                      −{formatPoisha(payment.refundedPoisha)} refunded
                    </p>
                  ) : null}
                  <span
                    className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${
                      payment.status === "CAPTURED"
                        ? "tone-success"
                        : payment.status === "REFUNDED"
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-ink-200 bg-ink-50 text-ink-600"
                    }`}
                  >
                    {payment.status.toLowerCase().replaceAll("_", " ")}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function index<T>(list: T[], item: T): number {
  return list.indexOf(item);
}
