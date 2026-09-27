import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatPoisha } from "@fixbondhu/core";

export const dynamic = "force-dynamic";

/**
 * Operations dashboard.
 *
 * requireStaff() runs on the server before any query, so this is inaccessible
 * without a staff session no matter what the client sends. Every figure is a
 * live aggregate. On day one most of these are legitimately zero, and a zero
 * here is information rather than a missing feature.
 */
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  await requireStaff();
  const { denied } = await searchParams;

  const dayAgo = new Date(Date.now() - 24 * 3_600_000);

  const [
    activeBookings,
    newRequests,
    pendingVerifications,
    openComplaints,
    capturedToday,
    capturedTotal,
    activeProviders,
    pendingProviders,
    users,
  ] = await Promise.all([
    prisma.booking.count({
      where: { status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] } },
    }),
    prisma.booking.count({ where: { status: "REQUESTED" } }),
    prisma.providerVerification.count({ where: { status: "PENDING" } }),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW", "AWAITING_CUSTOMER", "AWAITING_PROVIDER"] } } }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED", paidAt: { gte: dayAgo } },
      _sum: { amountPoisha: true, commissionPoisha: true },
    }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED" },
      _sum: { amountPoisha: true, commissionPoisha: true },
    }),
    prisma.providerProfile.count({ where: { status: "ACTIVE" } }),
    prisma.providerProfile.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);

  const alerts = [
    pendingVerifications > 0 && {
      label: "Verifications waiting for review",
      value: pendingVerifications,
      href: "/admin/verification",
      urgent: true,
    },
    newRequests > 0 && {
      label: "Requests awaiting provider response",
      value: newRequests,
      href: "/admin/bookings",
      urgent: false,
    },
    openComplaints > 0 && {
      label: "Open complaints and disputes",
      value: openComplaints,
      href: "/admin/complaints",
      urgent: true,
    },
    pendingProviders > 0 && {
      label: "Providers pending approval",
      value: pendingProviders,
      href: "/admin/providers",
      urgent: false,
    },
  ].filter(Boolean) as Array<{ label: string; value: number; href: string; urgent: boolean }>;

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Operations</h1>

      {denied ? (
        <div className="mt-3 rounded-[10px] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your role does not have access to that section.
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {alerts.map((alert) => (
            <li key={alert.label}>
              <Link
                href={alert.href}
                className={`flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-sm transition-colors ${
                  alert.urgent
                    ? "border-amber-300 bg-amber-50 hover:border-amber-400"
                    : "border-ink-200 bg-white hover:border-ink-300"
                }`}
              >
                <span className={alert.urgent ? "text-amber-900" : "text-ink-700"}>
                  {alert.label}
                </span>
                <span className="font-semibold tabular-nums">{alert.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card mt-4 px-4 py-3 text-sm text-ink-600">
          Nothing needs attention.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Active bookings" value={activeBookings} />
        <Metric label="Active providers" value={activeProviders} />
        <Metric label="Registered users" value={users} />
        <Metric
          label="Captured (24h)"
          value={formatPoisha(Number(capturedToday._sum.amountPoisha ?? 0))}
        />
        <Metric
          label="Commission (24h)"
          value={formatPoisha(Number(capturedToday._sum.commissionPoisha ?? 0))}
        />
        <Metric
          label="Captured (all time)"
          value={formatPoisha(Number(capturedTotal._sum.amountPoisha ?? 0))}
        />
        <Metric
          label="Commission (all time)"
          value={formatPoisha(Number(capturedTotal._sum.commissionPoisha ?? 0))}
        />
        <Metric label="Pending verifications" value={pendingVerifications} />
      </dl>

      <p className="mt-6 text-xs leading-relaxed text-ink-500">
        Revenue figures count only payments with status CAPTURED, which is set
        after the gateway confirms capture. A payment reported as paid by a
        client callback alone is never counted here.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink-900">
        {value}
      </dd>
    </div>
  );
}
