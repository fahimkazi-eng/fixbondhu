import type { NavGroup } from "@/components/surface-nav";
import { prisma } from "@/lib/db";

/**
 * Admin menu, derived from live counts.
 *
 * A badge means "someone is waiting on you", so each one is a real query. The
 * menu reflects genuine operational pressure rather than a fixed list, which is
 * what makes it usable at the start of a shift.
 */
export async function adminNav(): Promise<{ groups: NavGroup[]; unread: number }> {
  const [
    pendingVerifications,
    openComplaints,
    activeBookings,
    pendingPayouts,
    openTickets,
    pendingProviders,
  ] = await Promise.all([
    prisma.providerVerification.count({ where: { status: "PENDING" } }),
    prisma.complaint.count({
      where: { status: { in: ["OPEN", "IN_REVIEW", "AWAITING_CUSTOMER", "AWAITING_PROVIDER"] } },
    }),
    prisma.booking.count({
      where: { status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] } },
    }),
    prisma.payout.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING_AGENT"] } } }),
    prisma.providerProfile.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return {
    unread: openComplaints,
    groups: [
      {
        title: "Operations",
        items: [
          { href: "/admin", label: "Overview", short: "Overview" },
          { href: "/admin/bookings", label: "Bookings", count: activeBookings, short: "Bookings" },
          { href: "/admin/complaints", label: "Complaints", count: openComplaints, short: "Complaints" },
          { href: "/admin/support", label: "Support", count: openTickets, short: "Support" },
        ],
      },
      {
        title: "Supply",
        items: [
          {
            href: "/admin/providers",
            label: "Providers",
            count: pendingProviders,
            short: "Providers",
          },
          {
            href: "/admin/verification",
            label: "Verification",
            count: pendingVerifications,
            short: "Verify",
          },
          { href: "/admin/customers", label: "Customers", short: "Customers" },
        ],
      },
      {
        title: "Money",
        items: [
          { href: "/admin/payments", label: "Payments", short: "Payments" },
          { href: "/admin/payouts", label: "Payouts", count: pendingPayouts, short: "Payouts" },
          { href: "/admin/commission", label: "Commission", short: "Commission" },
        ],
      },
      {
        title: "Trust",
        items: [
          { href: "/admin/reviews", label: "Reviews", short: "Reviews" },
          { href: "/admin/audit", label: "Audit log", short: "Audit" },
        ],
      },
      {
        title: "Platform",
        items: [
          { href: "/admin/content", label: "Catalogue & promos", short: "Content" },
          { href: "/admin/analytics", label: "Analytics", short: "Analytics" },
          { href: "/admin/settings", label: "Settings", short: "Settings" },
        ],
      },
    ],
  };
}
