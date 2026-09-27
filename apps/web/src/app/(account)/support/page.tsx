import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Support", robots: { index: false } };
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "booking", label: "A booking", blurb: "Requests, rescheduling, cancellation" },
  { key: "payment", label: "A payment", blurb: "Charges, refunds, receipts" },
  { key: "quality", label: "Service quality", blurb: "The work did not meet expectations" },
  { key: "provider", label: "A provider", blurb: "Behaviour, no-show, conduct" },
  { key: "account", label: "My account", blurb: "Sign-in, phone number, details" },
  { key: "other", label: "Something else", blurb: "Anything not covered above" },
];

/**
 * Support.
 *
 * Triage categories and the two ways to get help that actually exist today: the
 * complaint route tied to a real booking, and a general support question. The
 * page does not offer a contact form that goes nowhere, and the categories are
 * fixed because a support inbox that accepts free-text subjects cannot be routed
 * to anyone.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const user = await requireUser("/support");
  const { sent } = await searchParams;

  const [tickets, complaintable, complaints] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { openedByUserId: user.id },
      orderBy: { lastMessageAt: "desc" },
      take: 20,
    }),
    prisma.booking.findMany({
      where: {
        customerId: user.id,
        status: { in: ["COMPLETED", "DISPUTED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { providerProfile: { select: { displayName: true } } },
    }),
    prisma.complaint.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Support</h1>
      <p className="mt-1.5 text-sm text-ink-600">
        Two routes: raise a complaint about a specific job, or ask a general
        question. Complaints are decided by FixBondhu, not by the provider.
      </p>

      {sent ? (
        <p
          role="status"
          className="animate-pop mt-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800"
        >
          {sent}
        </p>
      ) : null}

      {/* ---- open a complaint about a real job ---- */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">Complain about a job</h2>
        {complaintable.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-ink-600">
            Nothing to complain about yet. Complaints can be raised once a job is
            completed, cancelled or disputed.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {complaintable.map((booking) => (
              <li key={booking.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[15px] font-medium text-ink-900">
                    {booking.serviceNameEn}
                  </p>
                  <p className="text-xs text-ink-500">
                    {booking.providerProfile.displayName} · {booking.reference} ·{" "}
                    {formatPoisha(booking.totalPoisha)}
                  </p>
                </div>
                <Link
                  href={`/bookings/${booking.id}`}
                  className="btn btn-secondary"
                >
                  Open job
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs leading-relaxed text-ink-500">
          Raising a complaint is not built into the job page yet. What exists today
          is the resolution workflow on the admin side, which is tested.
        </p>
      </section>

      {/* ---- general question ---- */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">Ask a question</h2>
        <ul className="mt-2 space-y-1.5">
          {CATEGORIES.map((category) => (
            <li key={category.key} className="card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-ink-900">{category.label}</p>
                <p className="text-xs text-ink-500">{category.blurb}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="card mt-2 p-4 text-sm text-ink-600">
          The ticket form is not built yet. Until it is, these categories document
          what support will cover rather than pretending a form exists.
        </p>
      </section>

      {/* ---- history ---- */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">Your complaints</h2>
        {complaints.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-ink-600">No complaints raised.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {complaints.map((complaint) => (
              <li key={complaint.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-medium text-ink-900">
                      {complaint.subject}
                    </p>
                    <p className="text-xs text-ink-500">
                      {complaint.reference} ·{" "}
                      {new Date(complaint.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="chip">
                    {complaint.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>
                {complaint.resolution ? (
                  <p className="mt-2 rounded-md border border-ink-200 bg-ink-50 p-2.5 text-sm text-ink-700">
                    {complaint.resolution}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {tickets.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink-900">Your tickets</h2>
          <ul className="mt-2 space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="card p-4">
                <p className="text-[15px] font-medium text-ink-900">{ticket.subject}</p>
                <p className="text-xs text-ink-500">
                  {ticket.reference} · {ticket.status.toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
