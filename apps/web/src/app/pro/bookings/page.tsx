import type { Metadata } from "next";

import { requireActiveProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingList } from "@/components/booking-list";

export const metadata: Metadata = { title: "Booking history", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every booking this provider has ever had, closed and open. */
export default async function ProviderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireActiveProvider();
  const { filter } = await searchParams;

  const filters: Record<string, object> = {
    all: {},
    completed: { status: "COMPLETED" },
    cancelled: { status: { in: ["CANCELLED", "REJECTED"] } },
    disputed: { status: "DISPUTED" },
    reviewed: { review: { isNot: null } },
  };
  const active = filters[filter ?? "all"] ?? filters.all!;

  const bookings = await prisma.booking.findMany({
    where: { providerProfileId: user.providerProfileId, ...active },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      review: { select: { id: true } },
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
      reviewId: booking.review?.id ?? null,
    };
  });

  const tabs = [
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "disputed", label: "Disputed" },
    { key: "reviewed", label: "Reviewed" },
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Booking history</h1>

      <nav className="mt-3 flex flex-wrap gap-1" aria-label="Filter bookings">
        {tabs.map((tab) => {
          const isActive = (filter ?? "all") === tab.key;
          return (
            <a
              key={tab.key}
              href={tab.key === "all" ? "/pro/bookings" : `/pro/bookings?filter=${tab.key}`}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                isActive
                  ? "tone-accent"
                  : "border-ink-300 bg-ink-100 text-ink-600 hover:border-ink-400"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-4">
        <BookingList
          items={items}
          hrefBase="/pro/bookings"
          showParty="customer"
          emptyTitle="Nothing here yet"
          emptyBody="Bookings appear here once you start taking work. Nothing is invented to fill this page."
        />
      </div>
    </div>
  );
}
