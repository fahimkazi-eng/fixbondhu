import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireActiveProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettingNumber } from "@/lib/settings";
import { BookingList } from "@/components/booking-list";
import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = { title: "Requests", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * New requests awaiting a response.
 *
 * The response deadline is shown per request, because a provider needs to know
 * which one to answer first. It comes from a configurable setting rather than
 * being hard-coded, because the platform auto-cancels unanswered requests and
 * that window is a commercial decision.
 */
export default async function ProviderRequestsPage() {
  const user = await requireActiveProvider();
  const responseMinutes = await getSettingNumber("booking.providerResponseMinutes", 30);

  const requests = await prisma.booking.findMany({
    where: { providerProfileId: user.providerProfileId, status: "REQUESTED" },
    orderBy: { scheduledAt: "asc" },
    include: {
      customer: { select: { name: true, phone: true } },
      address: { select: { areaName: true, districtName: true } },
      additionalCharges: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  // The scheduled address is snapshotted onto the booking, so read from there
  // rather than the live Address row, which the customer may have changed.
  const items = requests.map((booking) => {
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
      customerPhone: booking.customer.phone,
      pendingChargeCount: booking.additionalCharges.length,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Requests</h1>
        <p className="text-xs text-ink-500">
          {requests.length === 0
            ? "Nothing waiting"
            : `${requests.length} waiting · you have ${responseMinutes} minutes to respond`}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="mt-4">
          <BookingList
            items={[]}
            hrefBase="/pro/bookings"
            showParty="customer"
            emptyTitle="No open requests"
            emptyBody="When a customer books one of your services it appears here for you to accept or decline. You can set your working hours in Availability so customers know when to reach you."
            emptyHref="/pro/calendar"
            emptyAction="Set my availability"
          />
        </div>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {items.map((booking, index) => {
            const hoursLeft = booking.scheduledAt.getTime() - Date.now();
            return (
              <li
                key={booking.id}
                className="card interactive animate-rise p-4"
                style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink-900">
                      {booking.serviceNameEn}
                    </p>
                    <p lang="bn" className="mt-0.5 text-sm text-ink-600">
                      {booking.serviceNameBn}
                    </p>
                    <p className="mt-1 text-sm text-ink-700">
                      {booking.customerName} · {booking.areaName}, {booking.districtName}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      {booking.reference}
                      <CopyButton value={booking.reference} label="Copy" />
                      {booking.customerPhone ? (
                        <a
                          href={`tel:${booking.customerPhone}`}
                          className="text-brand-700 underline"
                        >
                          {booking.customerPhone}
                        </a>
                      ) : null}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-ink-900">
                      ৳{(booking.totalPoisha / 100).toLocaleString("en-US")}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        hoursLeft < 3 * 3_600_000 ? "font-medium text-amber-700" : "text-ink-500"
                      }`}
                    >
                      {new Date(booking.scheduledAt).toLocaleString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
