import Link from "next/link";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha, formatBdPhone, STATUS_LABELS, STATUS_TONE } from "@fixbondhu/core";
import { BookingList } from "@/components/booking-list";

export const metadata: Metadata = { title: "Bookings", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every booking, with the same filter vocabulary as the customer view. */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff();
  const { status, q } = await searchParams;

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q.toUpperCase() } },
              { providerProfile: { displayName: { contains: q, mode: "insensitive" as const } } },
              { customer: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      providerProfile: { select: { displayName: true } },
    },
  });

  const items = bookings.map((booking) => {
    const address = booking.addressSnapshot as Record<string, string | null>;
    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      serviceNameEn: booking.serviceNameEn,
      serviceNameBn: booking.serviceNameBn,
      areaName: address.areaName ?? booking.areaName,
      districtName: address.districtName ?? booking.districtName,
      scheduledAt: booking.scheduledAt,
      totalPoisha: booking.totalPoisha,
      customerName: booking.customer.name,
      providerName: booking.providerProfile.displayName,
    };
  });

  const tabs = [
    { key: "", label: "All" },
    { key: "REQUESTED", label: "Requested" },
    { key: "ACCEPTED", label: "Accepted" },
    { key: "IN_PROGRESS", label: "In progress" },
    { key: "COMPLETED", label: "Completed" },
    { key: "DISPUTED", label: "Disputed" },
    { key: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Bookings</h1>

      <nav className="mt-4 flex flex-wrap items-center gap-1" aria-label="Filter bookings">
        {tabs.map((tab) => {
          const active = (status ?? "") === tab.key;
          return (
            <a
              key={tab.key || "all"}
              href={tab.key ? `/admin/bookings?status=${tab.key}` : "/admin/bookings"}
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

        <form action="/admin/bookings" className="ml-auto flex gap-1">
          <label className="sr-only" htmlFor="q">
            Search bookings
          </label>
          <input
            className="input h-8 w-48 text-xs"
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Reference, name"
          />
          <button className="btn btn-secondary h-8" type="submit">
            Search
          </button>
        </form>
      </nav>

      <div className="mt-4">
        <BookingList
          items={items}
          hrefBase="/admin/bookings"
          showParty="provider"
          emptyTitle="No bookings match"
          emptyBody="Nothing matches this filter. Bookings appear here as soon as a customer requests one."
        />
      </div>
    </div>
  );
}
