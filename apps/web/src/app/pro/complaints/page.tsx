import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Complaints", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  OPEN: "tone-danger",
  IN_REVIEW: "tone-warning",
  AWAITING_CUSTOMER: "border-ink-200 bg-ink-50 text-ink-700",
  AWAITING_PROVIDER: "border-blue-200 bg-blue-50 text-blue-800",
  RESOLVED: "tone-success",
  REJECTED: "border-ink-200 bg-ink-50 text-ink-600",
  CLOSED: "border-ink-200 bg-ink-50 text-ink-600",
};

/**
 * Complaints and disputes raised against this provider.
 *
 * A provider sees these read-only. Resolution is an admin decision, because
 * letting either party close their own complaint is how disputes disappear
 * instead of getting settled.
 */
export default async function ProviderComplaintsPage() {
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/services");

  const complaints = await prisma.complaint.findMany({
    where: { providerProfileId: user.providerProfileId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      dispute: { select: { status: true, claimAmountPoisha: true, awardedAmountPoisha: true } },
      customer: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Complaints and disputes
      </h1>
      <p className="mt-1.5 text-sm text-ink-600">
        These are decided by FixBondhu, not by either party. You will see every
        update here.
      </p>

      {complaints.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          Nothing has been raised against you.
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
                  <p className="text-[15px] font-medium text-ink-900">{complaint.subject}</p>
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
                    STATUS_TONE[complaint.status] ?? STATUS_TONE.OPEN
                  }`}
                >
                  {complaint.status.replaceAll("_", " ").toLowerCase()}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                {complaint.description}
              </p>

              {complaint.dispute ? (
                <p className="mt-2 text-xs text-ink-500">
                  Dispute opened · claimed{" "}
                  ৳{((complaint.dispute.claimAmountPoisha ?? 0) / 100).toLocaleString("en-US")}
                  {complaint.dispute.awardedAmountPoisha !== null
                    ? ` · awarded ৳${(complaint.dispute.awardedAmountPoisha / 100).toLocaleString("en-US")}`
                    : ""}
                </p>
              ) : null}

              {complaint.resolution ? (
                <div className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3">
                  <p className="text-xs font-medium text-ink-700">Decision</p>
                  <p className="mt-0.5 text-sm text-ink-700">{complaint.resolution}</p>
                  {complaint.resolutionType ? (
                    <p className="mt-1 text-xs text-ink-500">
                      {complaint.resolutionType.replaceAll("_", " ").toLowerCase()}
                    </p>
                  ) : null}
                </div>
              ) : null}

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
