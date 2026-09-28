import Link from "next/link";
import type { Metadata } from "next";

import { formatPoisha } from "@fixbondhu/core";

import { requireActiveProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Earnings", robots: { index: false } };
export const dynamic = "force-dynamic";

function startOfMonth(offset = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

/**
 * Earnings.
 *
 * Every figure is a sum over captured Payment rows, never a stored counter. The
 * gross/commission/net split is the same arithmetic the payout generator uses,
 * so a provider can reconcile what they see here against what they are paid.
 */
export default async function ProviderEarningsPage() {
  const user = await requireActiveProvider();
  const profileId = user.providerProfileId;

  const [thisMonth, lastMonth, allTime, recent, awaiting] = await Promise.all([
    prisma.payment.aggregate({
      where: { providerProfileId: profileId, status: "CAPTURED", paidAt: { gte: startOfMonth() } },
      _sum: { amountPoisha: true, commissionPoisha: true, providerAmountPoisha: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: {
        providerProfileId: profileId,
        status: "CAPTURED",
        paidAt: { gte: startOfMonth(-1), lt: startOfMonth() },
      },
      _sum: { amountPoisha: true, commissionPoisha: true, providerAmountPoisha: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { providerProfileId: profileId, status: "CAPTURED" },
      _sum: { amountPoisha: true, commissionPoisha: true, providerAmountPoisha: true },
      _count: true,
    }),
    prisma.payment.findMany({
      where: { providerProfileId: profileId, status: "CAPTURED" },
      orderBy: { paidAt: "desc" },
      take: 25,
      include: { booking: { select: { reference: true, serviceNameEn: true } } },
    }),
    prisma.booking.aggregate({
      where: {
        providerProfileId: profileId,
        status: "COMPLETED",
        paymentMethod: "CASH",
        paymentStatus: { not: "CAPTURED" },
      },
      _count: true,
    }),
  ]);

  const month = thisMonth._sum.providerAmountPoisha ?? 0;
  const prior = lastMonth._sum.providerAmountPoisha ?? 0;
  const change = prior > 0 ? Math.round(((month - prior) / prior) * 100) : null;

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Earnings</h1>

      {awaiting._count > 0 ? (
        <p className="mt-3 rounded-md tone-warning px-3 py-2 text-sm">
          {awaiting._count} completed cash{" "}
          {awaiting._count === 1 ? "job has" : "jobs have"} not been marked as
          collected yet. Confirm collection on each job so it reaches your
          balance.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="This month"
          value={formatPoisha(month)}
          sub={change === null ? undefined : `${change >= 0 ? "+" : ""}${change}% vs last month`}
        />
        <Card label="Last month" value={formatPoisha(prior)} />
        <Card
          label="All time"
          value={formatPoisha(allTime._sum.providerAmountPoisha ?? 0)}
          sub={`${allTime._count} payments`}
        />
        <Card
          label="Commission paid"
          value={formatPoisha(allTime._sum.commissionPoisha ?? 0)}
          sub="FixBondhu's fee"
        />
      </dl>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Recent payments</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">
            No payments yet. Earnings appear here once a customer has paid and the
            platform has recorded it.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
                  <th className="pb-2 font-medium">Job</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Customer paid</th>
                  <th className="pb-2 text-right font-medium">You earn</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((payment) => (
                  <tr key={payment.id} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/pro/bookings/${payment.bookingId}`}
                        className="text-ink-900 hover:underline"
                      >
                        {payment.booking.serviceNameEn}
                      </Link>
                      <span className="block text-xs text-ink-500">
                        {payment.booking.reference}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-ink-500">
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink-700">
                      {formatPoisha(payment.amountPoisha)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums text-ink-900">
                      {formatPoisha(payment.providerAmountPoisha)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        Only payments recorded as captured count towards earnings. Cash you have
        collected but not confirmed on the job does not appear here, so the
        figure always matches what can actually be paid out.
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
