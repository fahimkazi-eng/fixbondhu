import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { STATUS_LABELS, STATUS_TONE, formatPoisha } from "@fixbondhu/core";

import { requireActiveProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChargeRequestForm, JobActions } from "@/components/job-actions";
import { CopyButton } from "@/components/copy-button";
import { StatusTrack } from "@/components/status-track";

export const metadata: Metadata = { title: "Job", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  progress: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

/**
 * Provider job detail.
 *
 * The booking is fetched scoped to this provider's profile, so another
 * provider guessing the id gets a 404 rather than someone else's customer
 * address and phone number.
 */
export default async function ProviderBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireActiveProvider();

  const booking = await prisma.booking.findFirst({
    where: { id, providerProfileId: user.providerProfileId },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      additionalCharges: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      review: { select: { id: true, rating: true, body: true, customerReplyPending: true } as never },
    },
  });

  if (!booking) notFound();

  const address = booking.addressSnapshot as Record<string, string | null>;
  const tone = STATUS_TONE[booking.status];
  const captured = booking.paymentStatus === "CAPTURED";
  const pendingCharge = booking.additionalCharges.find((c) => c.status === "PENDING");
  const canRequestCharge = ["ARRIVED", "IN_PROGRESS"].includes(booking.status) && !pendingCharge;

  return (
    <div className="max-w-3xl">
      <Link href="/pro/jobs" className="text-sm text-ink-600 hover:text-ink-900">
        ← Back to jobs
      </Link>

      {/* ---- header ---- */}
      <section className="card animate-rise mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-ink-900">
              {booking.serviceNameEn}
            </h1>
            <p lang="bn" className="mt-0.5 text-sm text-ink-600">{booking.serviceNameBn}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-700">
              {booking.customer.name}
              <CopyButton value={booking.reference} label={booking.reference} />
            </p>
          </div>
          <span
            className={`animate-fade-in rounded-full border px-3 py-1 text-xs font-medium ${TONE[tone]}`}
          >
            {STATUS_LABELS[booking.status].en}
          </span>
        </div>

        <div className="mt-5">
          <StatusTrack status={booking.status} />
        </div>
      </section>

      {/* ---- the action bar ---- */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <JobActions
          bookingId={booking.id}
          status={booking.status}
          paymentMethod={booking.paymentMethod}
          paymentCaptured={captured}
        />

        {canRequestCharge ? (
          <ChargeRequestForm bookingId={booking.id} />
        ) : pendingCharge ? (
          <div className="card border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Waiting for the customer
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              You asked for an extra {formatPoisha(pendingCharge.amountPoisha)}:{" "}
              {pendingCharge.reason}
            </p>
            <p className="mt-2 text-xs text-amber-800">
              The job total is unchanged until they approve it. Do not carry out
              the extra work until they reply.
            </p>
          </div>
        ) : null}
      </div>

      {/* ---- customer and location ---- */}
      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Customer and location</h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <Row label="Name">{booking.customer.name}</Row>
          <Row label="Phone">
            <a href={`tel:${booking.customer.phone ?? ""}`} className="text-brand-700 underline">
              {booking.customer.phone ?? "Not provided"}
            </a>
          </Row>
          <Row label="Address">
            {address.line1}
            {address.landmark ? `, near ${address.landmark}` : ""}
            <br />
            <span className="text-ink-500">
              {address.areaName}, {address.districtName}
            </span>
          </Row>
          <Row label="Scheduled">
            {new Date(booking.scheduledAt).toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Row>
          {booking.customerNote ? (
            <Row label="Customer note">{booking.customerNote}</Row>
          ) : null}
        </dl>
      </section>

      {/* ---- money ---- */}
      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Money</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Customer pays">
            {formatPoisha(booking.agreedPricePoisha ?? booking.basePricePoisha)}
          </Row>
          {booking.extrasPoisha > 0 ? (
            <Row label="Approved extras">{formatPoisha(booking.extrasPoisha)}</Row>
          ) : null}
          <Row label="Platform commission">
            −{formatPoisha(booking.commissionPoisha)}
          </Row>
          <div className="flex items-baseline justify-between border-t border-ink-100 pt-2.5">
            <dt className="font-medium text-ink-900">You earn</dt>
            <dd className="text-base font-semibold tabular-nums text-ink-900">
              {formatPoisha(booking.providerEarningPoisha)}
            </dd>
          </div>
          <Row label="Payment">
            {booking.paymentMethod === "CASH" ? "Cash on site" : booking.paymentMethod}
            {" · "}
            <span className={captured ? "text-green-700" : "text-ink-500"}>
              {booking.paymentStatus.toLowerCase().replace("_", " ")}
            </span>
          </Row>
        </dl>
      </section>

      {/* ---- additional charge history ---- */}
      {booking.additionalCharges.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Additional charges</h2>
          <ul className="mt-3 space-y-2">
            {booking.additionalCharges.map((charge) => (
              <li key={charge.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-ink-900">{charge.reason}</p>
                  <span className="shrink-0 font-medium tabular-nums text-ink-900">
                    {formatPoisha(charge.amountPoisha)}
                  </span>
                </div>
                <p
                  className={`mt-1.5 text-xs ${
                    charge.status === "APPROVED"
                      ? "text-green-700"
                      : charge.status === "PENDING"
                        ? "font-medium text-amber-700"
                        : "text-ink-500"
                  }`}
                >
                  {charge.status === "APPROVED"
                    ? "Approved by the customer"
                    : charge.status === "PENDING"
                      ? "Waiting for the customer"
                      : charge.status === "REJECTED"
                        ? "Declined by the customer"
                        : "Withdrawn"}
                  {charge.customerNote ? ` — "${charge.customerNote}"` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- review ---- */}
      {booking.review ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Customer review</h2>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <span className="chip tabular-nums">{(booking.review as { rating: number }).rating}/5</span>
            {(booking.review as { body: string }).body}
          </p>
        </section>
      ) : null}

      {/* ---- history ---- */}
      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">History</h2>
        <ol className="mt-3 space-y-2">
          {booking.statusHistory.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-800">
                {entry.fromStatus
                  ? `${STATUS_LABELS[entry.fromStatus as keyof typeof STATUS_LABELS]?.en} → ${STATUS_LABELS[entry.toStatus as keyof typeof STATUS_LABELS]?.en}`
                  : "Requested"}
              </span>
              <span className="shrink-0 text-xs text-ink-400">
                {new Date(entry.createdAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ol>

        {booking.events.length > 0 ? (
          <>
            <h3 className="mt-5 text-xs font-medium text-ink-500">Activity</h3>
            <ul className="mt-2 space-y-1">
              {booking.events.map((event) => (
                <li key={event.id} className="text-xs text-ink-600">
                  {event.summary}
                  <span className="text-ink-400">
                    {" · "}
                    {new Date(event.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="max-w-[60%] text-right text-ink-900">{children}</dd>
    </div>
  );
}
