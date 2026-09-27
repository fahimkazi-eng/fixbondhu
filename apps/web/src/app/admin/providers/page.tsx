import Link from "next/link";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha, formatBdPhone } from "@fixbondhu/core";
import { setProviderStatus } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Providers", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "border-ink-200 bg-ink-50 text-ink-600",
  PENDING_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  ACTIVE: "border-green-200 bg-green-50 text-green-800",
  SUSPENDED: "border-red-200 bg-red-50 text-red-800",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  DEACTIVATED: "border-ink-200 bg-ink-50 text-ink-600",
};

/**
 * Provider management.
 *
 * Suspension is available here and is the fastest way to stop a provider being
 * dispatched. It is a form POST to a server action, so it cannot be triggered by
 * a crafted link, and it writes an audit row.
 */
export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff();
  const { status, q } = await searchParams;

  const providers = await prisma.providerProfile.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" as const } },
              { user: { phone: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      user: { select: { name: true, phone: true, email: true } },
      _count: { select: { bookings: true, reviews: true, services: true } },
      verifications: { select: { type: true, status: true } },
    },
  });

  const tabs = [
    { key: "", label: "All" },
    { key: "ACTIVE", label: "Active" },
    { key: "PENDING_REVIEW", label: "Pending" },
    { key: "SUSPENDED", label: "Suspended" },
    { key: "DRAFT", label: "Draft" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Providers</h1>

      <nav className="mt-4 flex flex-wrap items-center gap-1" aria-label="Filter providers">
        {tabs.map((tab) => {
          const active = (status ?? "") === tab.key;
          const href = tab.key
            ? `/admin/providers?status=${tab.key}`
            : "/admin/providers";
          return (
            <a
              key={tab.key || "all"}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              {tab.label}
            </a>
          );
        })}

        <form action="/admin/providers" className="ml-auto flex gap-1">
          <label className="sr-only" htmlFor="q">
            Search providers
          </label>
          <input
            className="input h-8 w-44 text-xs"
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Name or phone"
          />
          <button className="btn btn-secondary h-8" type="submit">
            Search
          </button>
        </form>
      </nav>

      {providers.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No providers match.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {providers.map((provider, index) => {
            const approved = provider.verifications.filter(
              (v) => v.status === "APPROVED",
            ).length;

            return (
              <li
                key={provider.id}
                className="card animate-rise p-4"
                style={{ "--i": Math.min(index, 10) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-medium text-ink-900">
                        {provider.displayName}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          STATUS_TONE[provider.status] ?? STATUS_TONE.DRAFT
                        }`}
                      >
                        {provider.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {provider.user.name} · {formatBdPhone(provider.user.phone ?? "")}
                      {provider.businessName ? ` · ${provider.businessName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {provider._count.services} services · {provider._count.bookings} jobs ·{" "}
                      {provider._count.reviews} reviews · {approved} verifications
                      {provider.noShowCount > 0 ? ` · ${provider.noShowCount} no-shows` : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-ink-900">
                      {provider.ratingCount > 0
                        ? `${provider.ratingAvg.toFixed(1)} (${provider.ratingCount})`
                        : "No reviews"}
                    </p>
                    <p className="text-xs text-ink-500">
                      {Math.round(provider.responseRate * 100)}% response
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatPoisha(Number(provider.totalEarningsPoisha))} earned
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                  <Link
                    href={`/providers/${provider.slug}`}
                    className="text-xs text-brand-700 underline"
                  >
                    Public profile
                  </Link>

                  {provider.verifications.some((v) => v.status === "PENDING") ? (
                    <Link href="/admin/verification" className="text-xs text-amber-700 underline">
                      {provider.verifications.filter((v) => v.status === "PENDING").length}{" "}
                      awaiting verification
                    </Link>
                  ) : null}

                  {provider.status === "ACTIVE" || provider.status === "SUSPENDED" ? (
                    <form action={setProviderStatus} className="ml-auto">
                      <input type="hidden" name="profileId" value={provider.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={provider.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                      />
                      <button
                        className={`btn ${provider.status === "ACTIVE" ? "btn-danger" : "btn-secondary"}`}
                        type="submit"
                      >
                        {provider.status === "ACTIVE" ? "Suspend" : "Reinstate"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
