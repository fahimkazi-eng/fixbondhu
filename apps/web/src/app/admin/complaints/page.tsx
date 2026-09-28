import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";
import { ResolveComplaintForm } from "@/components/resolve-complaint-form";

export const metadata: Metadata = { title: "Complaints", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  OPEN: "tone-danger",
  IN_REVIEW: "tone-warning",
  AWAITING_CUSTOMER: "border-ink-200 bg-ink-50 text-ink-700",
  AWAITING_PROVIDER: "border-blue-200 bg-blue-50 text-blue-800",
  RESOLVED: "tone-success",
  REJECTED: "border-ink-200 bg-ink-50 text-ink-600",
  CLOSED: "border-ink-200 bg-ink-50 text-ink-600",
};

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff("complaint:manage");
  const { status } = await searchParams;

  const where = status
    ? { status: status as never }
    : { status: { in: ["OPEN", "IN_REVIEW", "AWAITING_CUSTOMER", "AWAITING_PROVIDER"] as const } };

  const complaints = await prisma.complaint.findMany({
    where: { ...where } as never,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      customer: { select: { name: true, phone: true } },
      providerProfile: { select: { displayName: true } },
      dispute: true,
      events: { orderBy: { createdAt: "asc" } },
      booking: { select: { reference: true, totalPoisha: true, serviceNameEn: true } },
    },
  });

  const tabs = [
    { key: "", label: "Open" },
    { key: "RESOLVED", label: "Resolved" },
    { key: "REJECTED", label: "Dismissed" },
    { key: "CLOSED", label: "Closed" },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Complaints and disputes
      </h1>

      <nav className="mt-4 flex flex-wrap gap-1" aria-label="Filter complaints">
        {tabs.map((tab) => {
          const active = (status ?? "") === tab.key;
          return (
            <a
              key={tab.key || "open"}
              href={tab.key ? `/admin/complaints?status=${tab.key}` : "/admin/complaints"}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active
                  ? "tone-accent"
                  : "border-ink-300 bg-ink-100 text-ink-600 hover:border-ink-400"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>

      {complaints.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          Nothing in this queue.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-3">
          {complaints.map((complaint, index) => (
            <li
              key={complaint.id}
              className="card animate-rise p-4"
              style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-ink-900">
                      {complaint.subject}
                    </p>
                    {complaint.priority === "URGENT" || complaint.priority === "HIGH" ? (
                      <span className="rounded-full tone-danger px-2 py-0.5 text-xs">
                        {complaint.priority.toLowerCase()}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {complaint.reference} · {complaint.customer.name} ·{" "}
                    {new Date(complaint.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                    TONE[complaint.status] ?? TONE.OPEN
                  }`}
                >
                  {complaint.status.replaceAll("_", " ").toLowerCase()}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                {complaint.description}
              </p>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-ink-500 sm:grid-cols-2">
                {complaint.booking ? (
                  <div>
                    <dt className="inline">Job: </dt>
                    <dd className="inline">
                      {complaint.booking.serviceNameEn} · {complaint.booking.reference} ·{" "}
                      {formatPoisha(complaint.booking.totalPoisha)}
                    </dd>
                  </div>
                ) : null}
                {complaint.providerProfile ? (
                  <div>
                    <dt className="inline">Provider: </dt>
                    <dd className="inline">{complaint.providerProfile.displayName}</dd>
                  </div>
                ) : null}
                {complaint.dispute ? (
                  <div>
                    <dt className="inline">Claimed: </dt>
                    <dd className="inline">
                      {formatPoisha(complaint.dispute.claimAmountPoisha)}
                      {complaint.dispute.awardedAmountPoisha !== null
                        ? ` · awarded ${formatPoisha(complaint.dispute.awardedAmountPoisha)}`
                        : ""}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="inline">Against: </dt>
                  <dd className="inline">{complaint.against.toLowerCase()}</dd>
                </div>
              </dl>

              {complaint.resolution ? (
                <div className="mt-3 rounded-md tone-success p-3">
                  <p className="text-xs font-medium text-green-900">Decision recorded</p>
                  <p className="mt-0.5 text-sm text-green-900">{complaint.resolution}</p>
                </div>
              ) : (
                <details className="mt-3 border-t border-ink-100 pt-3" open>
                  <summary className="cursor-pointer text-xs font-medium text-ink-600">
                    Resolve this complaint
                  </summary>
                  <div className="mt-3">
                    <ResolveComplaintForm complaintId={complaint.id} />
                  </div>
                </details>
              )}

              {complaint.events.length > 0 ? (
                <details className="mt-3 border-t border-ink-100 pt-2">
                  <summary className="cursor-pointer text-xs font-medium text-ink-600">
                    Case history ({complaint.events.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {complaint.events.map((event) => (
                      <li key={event.id} className="text-xs text-ink-600">
                        <span className="text-ink-400">
                          {new Date(event.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>{" "}
                        {event.type}
                        {event.note ? ` — ${event.note}` : ""}
                        {event.actorRole ? ` (${event.actorRole})` : ""}
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
