import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  HAPPY_PATH,
  STATUS_LABELS,
  STATUS_TONE,
  formatPoisha,
  progressIndex,
} from "@fixbondhu/core";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CopyButton } from "@/components/copy-button";
import { BookingActions } from "@/components/booking-actions";
import { BookingProgress } from "@/components/booking-progress";
import { ChargeDecision } from "@/components/charge-decision";
import { ReviewForm } from "@/components/review-form";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE_CLASSES: Record<string, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  progress: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

const DOT_CLASSES: Record<string, string> = {
  neutral: "bg-ink-300",
  info: "bg-blue-500",
  progress: "bg-brand-600",
  success: "bg-green-600",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}`);

  // Scoped by customerId. A guessed id belonging to someone else is a 404, not
  // a permission error, so the page does not confirm that it exists.
  const booking = await prisma.booking.findFirst({
    where: { id, customerId: user.id },
    include: {
      statusHistory: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      additionalCharges: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      review: { select: { id: true, rating: true, body: true } },
      providerProfile: { select: { slug: true, displayName: true, user: { select: { phone: true } } } },
    },
  });

  if (!booking) notFound();

  const current = progressIndex(booking.status);
  const onHappyPath = current >= 0;
  const address = booking.addressSnapshot as Record<string, string | null>;
  const canCancel = ["REQUESTED", "ACCEPTED", "ON_THE_WAY"].includes(booking.status);
  const pendingCharges = booking.additionalCharges.filter((c) => c.status === "PENDING");

  return (
    <>
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/bookings" className="btn btn-secondary">← Bookings</Link>
          <Link href="/account" className="btn btn-secondary">Account</Link>
        </div>
      </header>

      <main id="main" className="container-page max-w-3xl py-6">
        {/* ---- summary ---- */}
        <section className="card animate-rise p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink-900">
                {booking.serviceNameEn}
              </h1>
              <p lang="bn" className="mt-0.5 text-sm text-ink-600">{booking.serviceNameBn}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-700">
                {booking.providerName}
                <CopyButton value={booking.reference} label={booking.reference} />
              </p>
            </div>
            <span
              className={`animate-fade-in rounded-full border px-3 py-1 text-xs font-medium ${TONE_CLASSES[STATUS_TONE[booking.status]]}`}
            >
              {STATUS_LABELS[booking.status].en}
            </span>
          </div>

          {/* ---- progress tracker ----
              Reads HAPPY_PATH from core, so the steps shown are exactly the ones
              the state machine permits. */}
          {onHappyPath ? (
            <div className="mt-6">
              <BookingProgress status={booking.status} />
            </div>
          ) : null}
        </section>

        {/* ---- pending charge decision ---- */}
        {pendingCharges.map((charge) => (
          <ChargeDecision key={charge.id} charge={charge} />
        ))}

        {/* ---- details ---- */}
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Details</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <Row label="Scheduled">
              {new Date(booking.scheduledAt).toLocaleString("en-GB", {
                weekday: "long", day: "numeric", month: "long",
                hour: "2-digit", minute: "2-digit",
              })}
            </Row>
            <Row label="Address">
              {address.line1}
              {address.landmark ? `, near ${address.landmark}` : ""}
              <br />
              <span className="text-ink-500">{address.areaName}, {address.districtName}</span>
            </Row>
            <Row label="Payment">
              {booking.paymentMethod === "CASH" ? "Cash on site" : booking.paymentMethod}
              {" · "}
              <span className={booking.paymentStatus === "CAPTURED" ? "text-green-700" : "text-ink-500"}>
                {booking.paymentStatus.toLowerCase().replace("_", " ")}
              </span>
            </Row>
            <Row label="Provider contact">
              <a href={`tel:${booking.providerPhone}`} className="text-brand-700 underline">
                {booking.providerPhone}
              </a>
            </Row>
            {booking.customerNote ? (
              <Row label="Your note">{booking.customerNote}</Row>
            ) : null}
          </dl>
        </section>

        {/* ---- price breakdown ---- */}
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Price</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Service">
              {booking.priceMode === "FIXED" || booking.agreedPricePoisha !== null
                ? formatPoisha(booking.agreedPricePoisha ?? booking.basePricePoisha)
                : `${formatPoisha(booking.quotedMinPoisha)} – ${formatPoisha(booking.quotedMaxPoisha)}`}
            </Row>
            {booking.extrasPoisha > 0 ? (
              <Row label="Approved extras">{formatPoisha(booking.extrasPoisha)}</Row>
            ) : null}
            {booking.discountPoisha > 0 ? (
              <Row label="Discount">−{formatPoisha(booking.discountPoisha)}</Row>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-ink-100 pt-2.5">
              <dt className="font-medium text-ink-900">Total</dt>
              <dd className="text-base font-semibold tabular-nums text-ink-900">
                {formatPoisha(booking.totalPoisha)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            A provider cannot raise this total without asking you first. Any extra
            charge appears above for your approval before the work continues.
          </p>
        </section>

        {/* ---- actions ---- */}
        <BookingActions bookingId={booking.id} canCancel={canCancel} />

        {/* ---- history ---- */}
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">History</h2>
          <ol className="mt-3 space-y-3">
            {booking.statusHistory.map((entry, index) => (
              <li key={entry.id} className="animate-slide-in flex gap-3" style={{ "--i": index } as React.CSSProperties}>
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      index === booking.statusHistory.length - 1
                        ? DOT_CLASSES[STATUS_TONE[entry.toStatus]]
                        : "bg-ink-300"
                    }`}
                    aria-hidden
                  />
                  {index < booking.statusHistory.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-ink-200" aria-hidden />
                  ) : null}
                </div>
                <div className="pb-1">
                  <p className="text-sm text-ink-900">
                    {entry.fromStatus
                      ? `${STATUS_LABELS[entry.fromStatus].en} → ${STATUS_LABELS[entry.toStatus].en}`
                      : "Booking requested"}
                  </p>
                  {entry.reason ? (
                    <p className="mt-0.5 text-xs text-ink-500">{entry.reason}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-ink-400">
                    {new Date(entry.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {booking.events.length > 0 ? (
            <>
              <h3 className="mt-5 text-xs font-medium text-ink-500">Activity</h3>
              <ul className="mt-2 space-y-1.5">
                {booking.events.map((event) => (
                  <li key={event.id} className="text-xs text-ink-600">
                    {event.summary}
                    <span className="text-ink-400">
                      {" · "}
                      {new Date(event.createdAt).toLocaleString("en-GB", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* ---- review ---- */}
        {booking.status === "COMPLETED" && !booking.review ? (
          <ReviewForm bookingId={booking.id} providerName={booking.providerName} />
        ) : null}
        {booking.review ? (
          <section className="card mt-4 p-5">
            <h2 className="text-sm font-semibold text-ink-900">Your review</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-600">
              <span className="chip tabular-nums">
                {booking.review.rating}/5
              </span>
              {booking.review.body}
            </p>
          </section>
        ) : null}
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right text-ink-900">{children}</dd>
    </div>
  );
}
