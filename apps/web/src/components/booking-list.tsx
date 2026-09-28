import Link from "next/link";
import { STATUS_LABELS, STATUS_TONE } from "@fixbondhu/core";

/**
 * Shared booking list.
 *
 * Requests, active jobs and history are the same records filtered three ways, so
 * they share one renderer. Duplicating it three times is how a status badge or
 * a price format ends up subtly different on one screen.
 */

export interface BookingListItem {
  id: string;
  reference: string;
  status: string;
  serviceNameEn: string;
  serviceNameBn: string;
  areaName: string;
  districtName: string;
  scheduledAt: Date;
  totalPoisha: number;
  providerName?: string;
  customerName?: string;
  customerPhone?: string;
  pendingChargeCount?: number;
  reviewId?: string | null;
}

const TONE: Record<string, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  progress: "tone-accent",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger",
};

const TONE_DOT: Record<string, string> = {
  neutral: "bg-ink-300",
  info: "bg-blue-500",
  progress: "bg-brand-600",
  success: "bg-green-600",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function BookingList({
  items,
  hrefBase,
  showParty = "customer",
  emptyTitle,
  emptyBody,
  emptyHref,
  emptyAction,
}: {
  items: BookingListItem[];
  hrefBase: string;
  /** Whose name to show. A provider sees the customer, a customer the provider. */
  showParty?: "customer" | "provider";
  emptyTitle: string;
  emptyBody: string;
  emptyHref?: string;
  emptyAction?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-[15px] font-medium text-ink-900">{emptyTitle}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-600">
          {emptyBody}
        </p>
        {emptyHref ? (
          <Link href={emptyHref} className="btn btn-primary mt-4">
            {emptyAction ?? "Go"}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="stagger space-y-2">
      {items.map((booking, index) => {
        const tone = STATUS_TONE[booking.status as keyof typeof STATUS_TONE] ?? "neutral";
        const party =
          showParty === "customer"
            ? booking.customerName
            : booking.providerName;

        return (
          <li key={booking.id} style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
            <Link href={`${hrefBase}/${booking.id}`} className="card interactive block p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status dot inherits the tone so the left edge of a list
                        reads as a status column without extra chrome. */}
                    <span
                      className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`}
                      aria-hidden
                    />
                    <p className="text-[15px] font-medium text-ink-900">
                      {booking.serviceNameEn}
                    </p>
                    <span
                      className={`animate-fade-in rounded-full border px-2 py-0.5 text-xs ${TONE[tone]}`}
                    >
                      {STATUS_LABELS[booking.status as keyof typeof STATUS_LABELS]?.en ?? booking.status}
                    </span>
                  </div>

                  <p lang="bn" className="mt-0.5 pl-4 text-sm text-ink-600">
                    {booking.serviceNameBn}
                  </p>

                  <p className="mt-1 pl-4 text-sm text-ink-700">
                    {party ? `${party} · ` : ""}
                    {booking.areaName}
                  </p>

                  <p className="mt-1 pl-4 text-xs text-ink-500">
                    {booking.reference} ·{" "}
                    {new Date(booking.scheduledAt).toLocaleString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-ink-900">
                    ৳{(booking.totalPoisha / 100).toLocaleString("en-US")}
                  </p>
                  {(booking.pendingChargeCount ?? 0) > 0 ? (
                    <p className="mt-1 animate-pulse text-xs font-medium text-amber-700">
                      Customer decision pending
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
