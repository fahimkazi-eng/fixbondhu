import type { Metadata } from "next";

import { formatPoisha } from "@fixbondhu/core";

import { requireActiveProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Payouts", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  PENDING: "Awaiting approval",
  APPROVED: "Approved, queued for payment",
  PROCESSING: "Being sent",
  PAID: "Paid",
  FAILED: "Failed — contact support",
  ON_HOLD: "On hold",
};

/**
 * Payouts.
 *
 * A payout is a batch of specific captured payments, and each one is listed so
 * a provider can see exactly which jobs make up a payment rather than being
 * handed an unexplained total.
 */
export default async function ProviderPayoutsPage() {
  const user = await requireActiveProvider();

  const [payouts, unpayouted, totalPaid] = await Promise.all([
    prisma.payout.findMany({
      where: { providerProfileId: user.providerProfileId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        items: {
          take: 20,
          include: { payment: { include: { booking: { select: { reference: true, serviceNameEn: true } } } } },
        },
      },
    }),
    prisma.payment.aggregate({
      where: {
        providerProfileId: user.providerProfileId,
        status: "CAPTURED",
        payoutItems: { none: {} },
      },
      _sum: { providerAmountPoisha: true },
      _count: true,
    }),
    prisma.payout.aggregate({
      where: { providerProfileId: user.providerProfileId, status: "PAID" },
      _sum: { netPoisha: true },
      _count: true,
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Payouts</h1>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="card px-4 py-3">
          <dt className="text-xs text-ink-500">Awaiting payout</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            {formatPoisha(unpayouted._sum.providerAmountPoisha ?? 0)}
          </dd>
          <p className="mt-0.5 text-xs text-ink-500">
            across {unpayouted._count} payments
          </p>
        </div>
        <div className="card px-4 py-3">
          <dt className="text-xs text-ink-500">Paid to date</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            {formatPoisha(totalPaid._sum.netPoisha ?? 0)}
          </dd>
          <p className="mt-0.5 text-xs text-ink-500">
            {totalPaid._count} {totalPaid._count === 1 ? "payout" : "payouts"}
          </p>
        </div>
      </dl>

      {payouts.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No payouts yet. FixBondhu batches earnings into a payout regularly once
          payments are recorded. You will see the exact jobs included in each one.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {payouts.map((payout, index) => (
            <li
              key={payout.id}
              className="card animate-rise p-4"
              style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-medium text-ink-900">{payout.reference}</p>
                  <p className="mt-0.5 text-sm text-ink-600">{STATUS[payout.status] ?? payout.status}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {new Date(payout.periodStart).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    to{" "}
                    {new Date(payout.periodEnd).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums text-ink-900">
                    {formatPoisha(payout.netPoisha)}
                  </p>
                  <p className="text-xs text-ink-500">
                    of {formatPoisha(payout.grossPoisha)} gross
                  </p>
                </div>
              </div>

              {payout.items.length > 0 ? (
                <details className="mt-3 border-t border-ink-100 pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-ink-600">
                    {payout.items.length}{" "}
                    {payout.items.length === 1 ? "job" : "jobs"} in this payout
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {payout.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <span className="text-ink-700">
                          {item.payment.booking.serviceNameEn}
                          <span className="ml-1 text-ink-400">
                            {item.payment.booking.reference}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-ink-900">
                          {formatPoisha(item.amountPoisha)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
