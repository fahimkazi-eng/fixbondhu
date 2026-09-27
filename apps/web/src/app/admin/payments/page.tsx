import Link from "next/link";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha, formatBdPhone } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Payments", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Payments.
 *
 * Only CAPTURED rows count as revenue anywhere on this platform. A payment
 * marked pending because a client callback was seen is not money, and showing
 * it as revenue is the single most damaging accounting error available here.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; method?: string }>;
}) {
  await requireStaff("payment:read");
  const { status, method } = await searchParams;

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(method ? { method: method as never } : {}),
  };

  const [payments, totals, byMethod] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        booking: { select: { reference: true, serviceNameEn: true } },
        customer: { select: { name: true } },
        providerProfile: { select: { displayName: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED" },
      _sum: { amountPoisha: true, commissionPoisha: true, providerAmountPoisha: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["method", "status"],
      where: { status: "CAPTURED" },
      _sum: { amountPoisha: true },
      _count: true,
    }),
  ]);

  const statusTabs = ["", "CAPTURED", "PENDING", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Payments</h1>

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Captured volume" value={formatPoisha(totals._sum.amountPoisha ?? 0)} sub={`${totals._count} payments`} />
        <Card label="Commission earned" value={formatPoisha(totals._sum.commissionPoisha ?? 0)} />
        <Card label="Owed to providers" value={formatPoisha(totals._sum.providerAmountPoisha ?? 0)} />
        <Card
          label="Effective rate"
          value={
            (totals._sum.amountPoisha ?? 0) > 0
              ? `${(((totals._sum.commissionPoisha ?? 0) / (totals._sum.amountPoisha ?? 1)) * 100).toFixed(1)}%`
              : "—"
          }
        />
      </dl>

      {byMethod.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Captured by method</h2>
          <ul className="mt-3 space-y-1.5">
            {byMethod.map((row) => (
              <li key={`${row.method}-${row.status}`} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-700">
                  {row.method} · {row.status.toLowerCase()}{" "}
                  <span className="text-ink-400">({row._count})</span>
                </span>
                <span className="tabular-nums text-ink-900">
                  {formatPoisha(row._sum.amountPoisha ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="mt-4 flex flex-wrap gap-1" aria-label="Filter payments">
        {statusTabs.map((key) => {
          const active = (status ?? "") === key;
          return (
            <a
              key={key || "all"}
              href={key ? `/admin/payments?status=${key}` : "/admin/payments"}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              {key ? key.replaceAll("_", " ").toLowerCase() : "All"}
            </a>
          );
        })}
      </nav>

      {payments.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No payments match this filter.
        </p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Parties</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/bookings/${payment.bookingId}`}
                      className="text-ink-900 hover:underline"
                    >
                      {payment.booking.serviceNameEn}
                    </Link>
                    <span className="block text-xs text-ink-500">
                      {payment.booking.reference}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-600">
                    {payment.customer.name}
                    <span className="block text-ink-400">
                      {payment.providerProfile.displayName}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-600">
                    {payment.method}
                    <span className="block text-ink-400">{payment.gateway}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        payment.status === "CAPTURED"
                          ? "border-green-200 bg-green-50 text-green-800"
                          : payment.status === "FAILED"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-ink-200 bg-ink-50 text-ink-600"
                      }`}
                    >
                      {payment.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">
                    {formatPoisha(payment.amountPoisha)}
                    {payment.refundedPoisha > 0 ? (
                      <span className="block text-xs text-red-600">
                        −{formatPoisha(payment.refundedPoisha)} refunded
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-600">
                    {formatPoisha(payment.commissionPoisha)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        A payment only reaches CAPTURED after the gateway confirms it, or when a
        provider confirms cash collection. Revenue figures count captured payments
        exclusively.
      </p>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink-900">
        {value}
      </dd>
      {sub ? <p className="mt-0.5 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );
}
