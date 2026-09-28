import Link from "next/link";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";
import { approvePayout } from "@/app/actions/admin";
import { GeneratePayoutsButton } from "@/components/generate-payouts-button";

export const metadata: Metadata = { title: "Payouts", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  PENDING: "tone-warning",
  APPROVED: "border-blue-200 bg-blue-50 text-blue-800",
  PROCESSING: "border-blue-200 bg-blue-50 text-blue-800",
  PAID: "tone-success",
  FAILED: "tone-danger",
  ON_HOLD: "border-ink-200 bg-ink-50 text-ink-600",
};

export default async function AdminPayoutsPage() {
  await requireStaff("payout:manage");

  const [payouts, unpaid] = await Promise.all([
    prisma.payout.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        providerProfile: { select: { displayName: true, user: { select: { phone: true } } } },
        _count: { select: { items: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED", payoutItems: { none: {} } },
      _sum: { providerAmountPoisha: true },
      _count: true,
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Payouts</h1>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Owed to providers</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
          {formatPoisha(unpaid._sum.providerAmountPoisha ?? 0)}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          across {unpaid._count} captured payments not yet in a payout
        </p>
        <div className="mt-4">
          <GeneratePayoutsButton />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">Batches</h2>
        {payouts.length === 0 ? (
          <p className="card mt-2 p-8 text-center text-sm text-ink-600">
            No payouts yet.
          </p>
        ) : (
          <ul className="stagger mt-2 space-y-2">
            {payouts.map((payout, index) => (
              <li
                key={payout.id}
                className="card animate-rise p-4"
                style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-medium text-ink-900">
                        {payout.reference}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          TONE[payout.status] ?? TONE.PENDING
                        }`}
                      >
                        {payout.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-600">
                      {payout.providerProfile.displayName} ·{" "}
                      {payout.providerProfile.user.phone}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {payout._count.items} payments ·{" "}
                      {new Date(payout.periodStart).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                      {" to "}
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
                      {formatPoisha(payout.grossPoisha)} gross
                    </p>
                  </div>
                </div>

                {payout.status === "PENDING" ? (
                  <form action={approvePayout} className="mt-3 border-t border-ink-100 pt-3">
                    <input type="hidden" name="payoutId" value={payout.id} />
                    <button className="btn btn-primary" type="submit">
                      Approve for payment
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
