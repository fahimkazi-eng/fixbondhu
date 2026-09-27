import type { Metadata } from "next";

import { Prisma } from "@fixbondhu/db";
import { formatPoisha } from "@fixbondhu/core";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Analytics", robots: { index: false } };
export const dynamic = "force-dynamic";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Analytics.
 *
 * Every number is derived from real rows. There is no fallback to a plausible
 * figure when a table is empty, because a dashboard that quietly shows invented
 * numbers is worse than one that shows nothing — and an empty marketplace is a
 * fact, not a failure.
 */
export default async function AdminAnalyticsPage() {
  await requireStaff("analytics:read");

  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 86_400_000);
  const previous30 = new Date(now.getTime() - 60 * 86_400_000);

  const [
    bookings30,
    bookingsPrev,
    completed30,
    providersActive,
    customers,
    services,
    captured30,
    capturedPrev,
    daily,
    topServices,
    topLocations,
    searchTerms,
  ] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: last30 } } }),
    prisma.booking.count({ where: { createdAt: { gte: previous30, lt: last30 } } }),
    prisma.booking.count({
      where: { status: "COMPLETED", completedAt: { gte: last30 } },
    }),
    prisma.providerProfile.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { customerProfile: { isNot: null }, deletedAt: null } }),
    prisma.service.count({ where: { isActive: true, isPublished: true } }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED", paidAt: { gte: last30 } },
      _sum: { amountPoisha: true, commissionPoisha: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED", paidAt: { gte: previous30, lt: last30 } },
      _sum: { amountPoisha: true },
    }),
    prisma.$queryRaw<Array<{ day: string; count: bigint; revenue: bigint }>>(Prisma.sql`
      SELECT
        to_char(b."createdAt", 'YYYY-MM-DD') AS day,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(b."totalPoisha"), 0)::bigint AS revenue
      FROM bookings b
      WHERE b."createdAt" >= ${last30}
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.booking.groupBy({
      by: ["serviceId"],
      where: { createdAt: { gte: last30 } },
      _count: true,
      orderBy: { _count: { serviceId: "desc" } },
      take: 10,
    }),
    prisma.$queryRaw<Array<{ area: string | null; count: bigint }>>(Prisma.sql`
      SELECT b."areaName" AS area, COUNT(*)::bigint AS count
      FROM bookings b
      WHERE b."createdAt" >= ${last30}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `),
    prisma.searchQueryLog.groupBy({
      by: ["normalizedQuery"],
      where: { createdAt: { gte: last30 } },
      _count: true,
      orderBy: { _count: { normalizedQuery: "desc" } },
      take: 20,
    }),
  ]);

  const serviceNames = await prisma.service.findMany({
    select: { id: true, nameEn: true },
  });
  const nameById = new Map(serviceNames.map((s) => [s.id, s.nameEn]));

  // Fill gaps so the chart does not imply activity on days with none.
  const byDay = new Map(daily.map((d) => [d.day, { count: Number(d.count), revenue: Number(d.revenue) }]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(last30.getTime() + i * 86_400_000);
    const key = dayKey(date);
    return { key, ...(byDay.get(key) ?? { count: 0, revenue: 0 }) };
  });
  const peak = Math.max(1, ...series.map((d) => d.count));

  const change = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? "new" : "—";
    const pct = Math.round(((current - previous) / previous) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs previous 30 days`;
  };

  const serviceLookup = await prisma.searchQueryLog.count();

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Analytics</h1>
      <p className="mt-1.5 text-sm text-ink-600">
        Last 30 days, counted from real records. Empty periods show as zero rather
        than being filled in.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Bookings" value={bookings30} sub={change(bookings30, bookingsPrev)} />
        <Card label="Completed" value={completed30} />
        <Card label="Active providers" value={providersActive} />
        <Card label="Customers" value={customers} />
        <Card label="Services live" value={services} />
        <Card
          label="Revenue captured"
          value={formatPoisha(captured30._sum.amountPoisha ?? 0)}
          sub={change(
            captured30._sum.amountPoisha ?? 0,
            capturedPrev._sum.amountPoisha ?? 0,
          )}
        />
        <Card
          label="Commission"
          value={formatPoisha(captured30._sum.commissionPoisha ?? 0)}
          sub={`${captured30._count} payments`}
        />
        <Card
          label="Completion rate"
          value={bookings30 > 0 ? `${Math.round((completed30 / bookings30) * 100)}%` : "—"}
          sub={bookings30 > 0 ? `${completed30} of ${bookings30}` : "no bookings yet"}
        />
      </dl>

      {/* ---- bookings per day ---- */}
      <section className="card mt-5 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Bookings per day</h2>
        {series.every((d) => d.count === 0) ? (
          <p className="mt-3 text-sm text-ink-600">
            No bookings in the last 30 days. The chart stays empty rather than
            showing a sample trend.
          </p>
        ) : (
          <>
            <div className="mt-4 flex h-28 items-end gap-[2px]" role="img" aria-label="Bookings per day over the last 30 days">
              {series.map((day) => (
                <div
                  key={day.key}
                  className="flex-1 rounded-t bg-brand-600 transition-[height] duration-300"
                  style={{ height: `${Math.max(2, (day.count / peak) * 100)}%` }}
                  title={`${day.key}: ${day.count} bookings, ৳${(day.revenue / 100).toFixed(0)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-400">
              <span>{series[0]?.key}</span>
              <span>{series[series.length - 1]?.key}</span>
            </div>
          </>
        )}
      </section>

      {/* ---- what people search for: the launch-planning signal ---- */}
      {searchTerms.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">
            What customers searched for
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {serviceLookup} searches recorded. A term with many searches and few
            providers is where recruitment should go next.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {searchTerms.map((term) => (
              <li key={term.normalizedQuery} className="chip">
                {term.normalizedQuery || "(empty)"}
                <span className="text-ink-400">×{term._count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- top services and areas ---- */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Most requested services</h2>
          {topServices.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600">No bookings yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {topServices.map((row) => (
                <li key={row.serviceId} className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-700">{nameById.get(row.serviceId) ?? row.serviceId}</span>
                  <span className="tabular-nums text-ink-900">{row._count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Where demand is</h2>
          {topLocations.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600">No bookings yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {topLocations.map((row) => (
                <li key={row.area ?? "unknown"} className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-700">{row.area ?? "Unknown"}</span>
                  <span className="tabular-nums text-ink-900">{Number(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
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
