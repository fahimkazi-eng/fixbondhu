import type { Metadata } from "next";

import { requireActiveProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingList } from "@/components/booking-list";

export const metadata: Metadata = { title: "Active jobs", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Jobs currently under way, in the order they need attention. */
export default async function ProviderJobsPage() {
  const user = await requireActiveProvider();

  const bookings = await prisma.booking.findMany({
    where: {
      providerProfileId: user.providerProfileId,
      status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] },
    },
    // Oldest appointment first: the job that is due soonest is the one a
    // provider must act on next.
    orderBy: { scheduledAt: "asc" },
    include: { customer: { select: { name: true } } },
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
      pendingChargeCount: 0,
    };
  });

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Active jobs</h1>
      <p className="mt-1 text-xs text-ink-500">
        Open a job to update its status as you travel, arrive and work.
      </p>

      <div className="mt-4">
        <BookingList
          items={items}
          hrefBase="/pro/bookings"
          showParty="customer"
          emptyTitle="No jobs in progress"
          emptyBody="Once you accept a request the job appears here so you can keep the customer updated as you travel, arrive and complete the work."
        />
      </div>
    </div>
  );
}
