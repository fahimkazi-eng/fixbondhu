import type { NavGroup } from "@/components/surface-nav";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";

/**
 * Menu definition, derived from live counts.
 *
 * The request count is a real query, not a stored number, because a badge that
 * disagrees with the list behind it is worse than no badge. Everything with no
 * count simply renders without one.
 */
export async function providerNav(profileId: string): Promise<{ groups: NavGroup[]; unread: number }> {
  const [openRequests, activeJobs, pendingVerification, unread] = await Promise.all([
    prisma.booking.count({ where: { providerProfileId: profileId, status: "REQUESTED" } }),
    prisma.booking.count({
      where: {
        providerProfileId: profileId,
        status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] },
      },
    }),
    prisma.providerVerification.count({
      where: { providerProfileId: profileId, status: "PENDING" },
    }),
    unreadCount(profileId),
  ]);

  return {
    unread,
    groups: [
      {
        title: "Work",
        items: [
          { href: "/pro/requests", label: "Requests", count: openRequests, short: "Requests" },
          { href: "/pro/jobs", label: "Active jobs", count: activeJobs, short: "Jobs" },
          { href: "/pro/bookings", label: "History", short: "History" },
          { href: "/pro/calendar", label: "Availability", short: "Calendar" },
        ],
      },
      {
        title: "Profile",
        items: [
          { href: "/pro/services", label: "Services & pricing", short: "Services" },
          { href: "/pro/areas", label: "Service areas", short: "Areas" },
          { href: "/pro/profile", label: "Profile", short: "Profile" },
          {
            href: "/pro/verification",
            label: "Verification",
            count: pendingVerification,
            short: "Verify",
          },
        ],
      },
      {
        title: "Money",
        items: [
          { href: "/pro/earnings", label: "Earnings", short: "Earnings" },
          { href: "/pro/payouts", label: "Payouts", short: "Payouts" },
        ],
      },
      {
        title: "Customers",
        items: [
          { href: "/pro/messages", label: "Messages", short: "Messages" },
          { href: "/pro/reviews", label: "Reviews", short: "Reviews" },
          { href: "/pro/complaints", label: "Complaints", short: "Complaints" },
        ],
      },
    ],
  };
}

/** Shared header block so every provider page titles itself identically. */
export async function providerContext(): Promise<{
  profileId: string | null;
  user: Awaited<ReturnType<typeof getUser>>;
}> {
  const user = await getUser();
  return { user, profileId: user?.providerProfileId ?? null };
}
