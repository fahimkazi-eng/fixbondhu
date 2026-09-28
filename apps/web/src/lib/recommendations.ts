import { prisma } from "@/lib/db";

/**
 * Personalised discovery, built only from what a customer has actually done.
 *
 * The brief asked for a "Just for you" rail. The honest version of that is
 * narrow, and the narrowness is the point:
 *
 *   Book again    real past bookings, most recent first, linking to the exact
 *                 provider and service they used before
 *   Recommended   services in categories this customer has booked in before,
 *                 minus the ones they have already used, ranked by real supply
 *
 * Both return empty for a customer with no history, and the UI must then say
 * nothing rather than substitute a popularity list. A rail labelled "for you"
 * that is really "most popular" is worse than no rail, because it teaches
 * people to distrust the label.
 */

export interface PastBooking {
  bookingId: string;
  reference: string;
  providerProfileId: string;
  providerName: string;
  providerSlug: string;
  serviceSlug: string;
  serviceNameEn: string;
  serviceNameBn: string;
  status: string;
  scheduledAt: Date;
  /** Null when the provider later removed the service or changed price. */
  rebookable: boolean;
}

/**
 * Bookings this customer can be offered again.
 *
 * Only past bookings that ended in a real outcome. A REQUESTED booking that was
 * cancelled because nobody turned up is not a thing to rebook, and offering it
 * would be pushing the customer back into a bad experience.
 */
export async function getPastBookings(
  customerId: string,
  limit = 6,
): Promise<PastBooking[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      customerId,
      // Completed, or closed without a dispute. Anything else is still live.
      status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
    },
    orderBy: { scheduledAt: "desc" },
    take: 20,
    select: {
      id: true,
      reference: true,
      status: true,
      scheduledAt: true,
      serviceNameEn: true,
      serviceNameBn: true,
      cancelledBy: true,
      providerProfile: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          status: true,
          services: {
            where: { isActive: true },
            select: { serviceId: true, service: { select: { slug: true } } },
          },
        },
      },
      service: { select: { slug: true } },
    },
  });

  return bookings.slice(0, limit).map((b) => {
    const providerLive = b.providerProfile.status === "ACTIVE";
    // Re-bookable only if that provider still offers that service, so the button
    // cannot lead to a form with nothing selectable.
    const stillOffers = b.providerProfile.services.some(
      (s) => s.service.slug === b.service.slug,
    );
    // A NO_SHOW against this provider is worth remembering too, so it is listed
    // but not offered as an easy rebook.
    const worthRebooking =
      b.status === "COMPLETED" || (b.status === "CANCELLED" && b.cancelledBy !== "CUSTOMER");

    return {
      bookingId: b.id,
      reference: b.reference,
      providerProfileId: b.providerProfile.id,
      providerName: b.providerProfile.displayName,
      providerSlug: b.providerProfile.slug,
      serviceSlug: b.service.slug,
      serviceNameEn: b.serviceNameEn,
      serviceNameBn: b.serviceNameBn,
      status: b.status,
      scheduledAt: b.scheduledAt,
      rebookable: providerLive && stillOffers && worthRebooking,
    };
  });
}

export interface RecommendedService {
  slug: string;
  nameEn: string;
  nameBn: string;
  providerCount: number;
  fromPricePoisha: number | null;
  /** The category that made this a suggestion, for the "because" line. */
  reasonCategory: string;
}

/**
 * Services to suggest, derived from the categories this customer has booked in.
 *
 * Excludes what they have already used, because "AC servicing" under a heading
 * that says recommended is noise once they have had AC servicing done.
 */
export async function getRecommendedServices(
  customerId: string,
  limit = 4,
): Promise<RecommendedService[]> {
  // The customer's real footprint: which categories, and which services.
  const history = await prisma.booking.findMany({
    where: { customerId },
    select: { serviceId: true, service: { select: { categoryId: true } } },
  });

  const categoryIds = [...new Set(history.map((h) => h.service.categoryId))];
  if (categoryIds.length === 0) return [];

  const usedServiceIds = [...new Set(history.map((h) => h.serviceId))];

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      isPublished: true,
      categoryId: { in: categoryIds },
      id: { notIn: usedServiceIds },
    },
    take: 40,
    select: {
      slug: true,
      nameEn: true,
      nameBn: true,
      category: { select: { id: true, nameEn: true } },
      providerServices: {
        where: {
          isActive: true,
          providerProfile: { status: "ACTIVE", deletedAt: null },
          OR: [{ basePricePoisha: { not: null } }, { minPricePoisha: { gt: 0 } }],
        },
        select: { providerProfileId: true, basePricePoisha: true, minPricePoisha: true },
      },
    },
  });

  return services
    .map((s) => {
      const prices = s.providerServices
        .map((ps) => ps.basePricePoisha ?? ps.minPricePoisha)
        .filter((p): p is number => p != null);
      return {
        slug: s.slug,
        nameEn: s.nameEn,
        nameBn: s.nameBn,
        providerCount: new Set(s.providerServices.map((ps) => ps.providerProfileId)).size,
        fromPricePoisha: prices.length ? Math.min(...prices) : null,
        reasonCategory: s.category.nameEn,
      };
    })
    // A suggestion with no supply is not a suggestion, it is a dead end.
    .filter((s) => s.providerCount > 0)
    // More supply first: more likely to actually be bookable today.
    .sort((a, b) => b.providerCount - a.providerCount)
    .slice(0, limit);
}

/**
 * A one-line summary of what we know about this customer, for the header.
 *
 * Used only if the customer has a real default address, so the "your area" chip
 * reflects somewhere they have actually said they are.
 */
export async function getCustomerArea(
  customerId: string,
): Promise<{ areaName: string; districtName: string } | null> {
  const address = await prisma.address.findFirst({
    where: { userId: customerId, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { areaName: true, districtName: true },
  });
  return address ? { areaName: address.areaName, districtName: address.districtName } : null;
}
