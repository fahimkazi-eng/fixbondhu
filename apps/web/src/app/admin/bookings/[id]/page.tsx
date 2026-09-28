import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha, formatBdPhone, STATUS_LABELS, STATUS_TONE } from "@fixbondhu/core";
import { StatusTrack } from "@/components/status-track";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  progress: "tone-accent",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger",
};

/** Single booking with the full audit trail, for support and disputes. */
export default async function AdminBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaff();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      providerProfile: { select: { displayName: true, slug: true, user: { select: { phone: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
      additionalCharges: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      review: true,
      complaints: { select: { id: true, reference: true, subject: true, status: true } },
    },
  });

  if (!booking) notFound();

  const address = booking.addressSnapshot as Record<string, string | null>;
  const tone = STATUS_TONE[booking.status];

  return (
    <div className="max-w-3xl">
      <Link href="/admin/bookings" className="text-sm text-ink-600 hover:text-ink-900">
        ← All bookings
      </Link>

      <section className="card animate-rise mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink-900">
              {booking.serviceNameEn}
            </h1>
            <p className="mt-0.5 text-sm text-ink-600">{booking.reference}</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${TONE[tone]}`}
          >
            {STATUS_LABELS[booking.status].en}
          </span>
        </div>
        <div className="mt-5">
          <StatusTrack status={booking.status} />
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Parties</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Customer">
            {booking.customer.name} · {formatBdPhone(booking.customer.phone ?? "")}
          </Row>
          <Row label="Provider">
            <Link
              href={`/providers/${booking.providerProfile.slug}`}
              className="text-brand-300 underline"
            >
              {booking.providerProfile.displayName}
            </Link>{" "}
            · {formatBdPhone(booking.providerProfile.user.phone ?? "")}
          </Row>
          <Row label="Address">
            {address.line1}, {address.areaName}, {address.districtName}
          </Row>
          <Row label="Scheduled">
            {new Date(booking.scheduledAt).toLocaleString("en-GB")}
          </Row>
        </dl>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Money</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Base">{formatPoisha(booking.basePricePoisha)}</Row>
          {booking.extrasPoisha > 0 ? (
            <Row label="Approved extras">{formatPoisha(booking.extrasPoisha)}</Row>
          ) : null}
          {booking.discountPoisha > 0 ? (
            <Row label="Discount">−{formatPoisha(booking.discountPoisha)}</Row>
          ) : null}
          <Row label="Total charged">{formatPoisha(booking.totalPoisha)}</Row>
          <Row label="Commission">{formatPoisha(booking.commissionPoisha)}</Row>
          <Row label="Provider earning">{formatPoisha(booking.providerEarningPoisha)}</Row>
          <Row label="Payment">
            {booking.paymentMethod} · {booking.paymentStatus}
          </Row>
        </dl>
      </section>

      {booking.payments.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Payment records</h2>
          <ul className="mt-3 space-y-1.5">
            {booking.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-700">
                  {payment.method} via {payment.gateway}
                  {payment.gatewayReference ? ` · ${payment.gatewayReference}` : ""}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    payment.status === "CAPTURED" ? "text-green-700" : "text-ink-500"
                  }`}
                >
                  {formatPoisha(payment.amountPoisha)} {payment.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {booking.additionalCharges.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Additional charges</h2>
          <ul className="mt-3 space-y-2">
            {booking.additionalCharges.map((charge) => (
              <li key={charge.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-700">{charge.reason}</span>
                  <span className="font-medium tabular-nums">
                    {formatPoisha(charge.amountPoisha)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {charge.status}
                  {charge.customerNote ? ` — "${charge.customerNote}"` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {booking.complaints.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Complaints</h2>
          <ul className="mt-3 space-y-1.5">
            {booking.complaints.map((complaint) => (
              <li key={complaint.id} className="text-sm">
                <Link
                  href="/admin/complaints"
                  className="text-brand-300 underline"
                >
                  {complaint.subject}
                </Link>
                <span className="ml-2 text-xs text-ink-500">
                  {complaint.reference} · {complaint.status.toLowerCase().replaceAll("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {booking.review ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Review</h2>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <span className="chip tabular-nums">{booking.review.rating}/5</span>
            {booking.review.body}
          </p>
        </section>
      ) : null}

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Full history</h2>
        <ol className="mt-3 space-y-1.5">
          {booking.statusHistory.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3 text-sm">
              <span className="text-ink-700">
                {entry.fromStatus
                  ? `${STATUS_LABELS[entry.fromStatus as keyof typeof STATUS_LABELS]?.en} → ${STATUS_LABELS[entry.toStatus as keyof typeof STATUS_LABELS]?.en}`
                  : "Requested"}
                {entry.reason ? ` — ${entry.reason}` : ""}
              </span>
              <span className="shrink-0 text-xs text-ink-400">
                {new Date(entry.createdAt).toLocaleString("en-GB")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
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
