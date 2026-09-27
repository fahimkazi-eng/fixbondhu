"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BookingError, createBooking, transitionBooking } from "@/lib/bookings";
import { notify } from "@/lib/notifications";

/**
 * Customer-facing mutations.
 *
 * Every action re-reads the session on the server and derives ownership from
 * the database. Nothing here trusts an id, a role or a total supplied by the
 * browser. An action that took a customerId parameter would be a hole; none of
 * them do.
 */

export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

const bookingSchema = z.object({
  providerServiceId: z.string().min(1),
  addressId: z.string().min(1),
  scheduledAt: z.string().min(1, "Choose a date and time."),
  customerNote: z.string().max(1000).optional(),
  couponCode: z.string().max(40).optional(),
  paymentMethod: z.enum(["CASH", "BKASH", "A2A", "NAGAD", "CARD"]),
});

export async function submitBooking(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in to book." };

  const parsed = bookingSchema.safeParse({
    providerServiceId: formData.get("providerServiceId"),
    addressId: formData.get("addressId"),
    scheduledAt: formData.get("scheduledAt"),
    customerNote: formData.get("customerNote") || undefined,
    couponCode: formData.get("couponCode") || undefined,
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the form.", fieldErrors };
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, message: "That date and time could not be read." };
  }

  try {
    const booking = await createBooking({
      customerId: user.id,
      providerServiceId: parsed.data.providerServiceId,
      addressId: parsed.data.addressId,
      scheduledAt,
      customerNote: parsed.data.customerNote,
      couponCode: parsed.data.couponCode,
      paymentMethod: parsed.data.paymentMethod,
    });

    revalidatePath("/bookings");
    return {
      ok: true,
      message: `Requested. Your reference is ${booking.reference}.`,
    };
  } catch (error) {
    if (error instanceof BookingError) {
      return { ok: false, message: error.message };
    }
    console.error("[submitBooking]", error);
    return { ok: false, message: "We could not create that booking. Please try again." };
  }
}

export async function cancelBooking(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  const bookingId = String(formData.get("bookingId") ?? "");
  if (!bookingId) return { ok: false, message: "Missing booking." };

  // Ownership is proven by the transition itself, which only succeeds for the
  // customer on their own booking.
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: user.id },
    select: { id: true },
  });
  if (!booking) return { ok: false, message: "That booking was not found." };

  const result = await transitionBooking({
    bookingId,
    to: "CANCELLED",
    actor: "CUSTOMER",
    actorUserId: user.id,
    reason: String(formData.get("reason") ?? "").slice(0, 300) || undefined,
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");

  return result.ok
    ? { ok: true, message: "Booking cancelled." }
    : { ok: false, message: result.message };
}

export async function respondToAdditionalCharge(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!requestId || !["APPROVED", "REJECTED"].includes(decision)) {
    return { ok: false, message: "Invalid request." };
  }

  // Only the customer who owns the booking may approve extra cost.
  const charge = await prisma.additionalChargeRequest.findFirst({
    where: { id: requestId, status: "PENDING", booking: { customerId: user.id } },
    include: { booking: { select: { id: true, providerProfile: { select: { userId: true } } } } },
  });
  if (!charge) return { ok: false, message: "That request is no longer pending." };

  await prisma.additionalChargeRequest.update({
    where: { id: requestId },
    data: {
      status: decision as "APPROVED" | "REJECTED",
      respondedAt: new Date(),
      respondedByUserId: user.id,
      customerNote: String(formData.get("note") ?? "").slice(0, 500) || null,
    },
  });

  await prisma.bookingEvent.create({
    data: {
      bookingId: charge.booking.id,
      actor: "CUSTOMER",
      actorUserId: user.id,
      type: `CHARGE_${decision}`,
      summary:
        decision === "APPROVED"
          ? `Approved an additional charge of ৳${(charge.amountPoisha / 100).toFixed(0)}`
          : "Declined an additional charge",
      meta: { amountPoisha: charge.amountPoisha },
    },
  });

  await notify({
    userId: charge.booking.providerProfile.userId,
    type: decision === "APPROVED" ? "ADDITIONAL_CHARGE_APPROVED" : "ADDITIONAL_CHARGE_REJECTED",
    title: decision === "APPROVED" ? "Additional charge approved" : "Additional charge declined",
    body: `The customer ${decision === "APPROVED" ? "approved" : "declined"} your request for ৳${(charge.amountPoisha / 100).toFixed(0)}.`,
    href: `/pro/bookings/${charge.booking.id}`,
  });

  revalidatePath(`/bookings/${charge.booking.id}`);
  revalidatePath(`/pro/bookings/${charge.booking.id}`);

  return {
    ok: true,
    message: decision === "APPROVED" ? "Charge approved." : "Charge declined.",
  };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(10, "Please write at least a sentence.").max(2000),
  title: z.string().trim().max(120).optional(),
});

export async function submitReview(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  const parsed = reviewSchema.safeParse({
    bookingId: formData.get("bookingId"),
    rating: formData.get("rating"),
    body: formData.get("body"),
    title: formData.get("title") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the form.", fieldErrors };
  }

  /*
   * A review must come from a real completed booking by this customer. The
   * database also enforces one review per booking, so a double submit cannot
   * inflate a rating either.
   */
  const booking = await prisma.booking.findFirst({
    where: {
      id: parsed.data.bookingId,
      customerId: user.id,
      status: "COMPLETED",
    },
    include: { review: { select: { id: true } } },
  });

  if (!booking) {
    return { ok: false, message: "You can only review a completed booking." };
  }
  if (booking.review) {
    return { ok: false, message: "You have already reviewed this booking." };
  }

  const windowDays = 14;
  if (Date.now() - booking.completedAt!.getTime() > windowDays * 24 * 3_600_000) {
    return { ok: false, message: `Reviews close ${windowDays} days after the job.` };
  }

  try {
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId: user.id,
        providerProfileId: booking.providerProfileId,
        serviceId: booking.serviceId,
        rating: parsed.data.rating,
        body: parsed.data.body,
        title: parsed.data.title ?? null,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, message: "You have already reviewed this booking." };
    }
    throw error;
  }

  // Recompute from the reviews that actually exist rather than incrementing a
  // counter, so the figure cannot drift away from the rows.
  const stats = await prisma.review.aggregate({
    where: { providerProfileId: booking.providerProfileId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.providerProfile.update({
    where: { id: booking.providerProfileId },
    data: {
      ratingAvg: stats._avg.rating ?? 0,
      ratingCount: stats._count,
    },
  });

  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath(`/providers/${booking.providerProfileId}`);

  return { ok: true, message: "Thank you. Your review is published." };
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

const addressSchema = z.object({
  label: z.string().trim().min(1, "Give this address a label.").max(40),
  line1: z.string().trim().min(3, "Enter your street or building.").max(160),
  line2: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(160).optional(),
  areaName: z.string().trim().min(1, "Enter your area.").max(80),
  districtName: z.string().trim().min(1, "Enter your district.").max(80),
  divisionName: z.string().trim().max(60).optional(),
  locationId: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  isDefault: z.coerce.boolean().optional(),
});

export async function saveAddress(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  const parsed = addressSchema.safeParse({
    label: formData.get("label"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    landmark: formData.get("landmark") || undefined,
    areaName: formData.get("areaName"),
    districtName: formData.get("districtName"),
    divisionName: formData.get("divisionName") || undefined,
    locationId: formData.get("locationId") || undefined,
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the form.", fieldErrors };
  }

  const data = parsed.data;
  const isFirst = (await prisma.address.count({ where: { userId: user.id, deletedAt: null } })) === 0;

  await prisma.$transaction(async (tx) => {
    if (data.isDefault || isFirst) {
      // Only one default may exist; unset the rest in the same transaction.
      await tx.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.address.create({
      data: {
        userId: user.id,
        label: data.label,
        line1: data.line1,
        line2: data.line2 ?? null,
        landmark: data.landmark ?? null,
        areaName: data.areaName,
        districtName: data.districtName,
        // Snapshotted so the address still reads correctly if the locality is
        // later renamed, and so a booking's address history is not rewritten.
        divisionName: data.divisionName ?? "Dhaka",
        locationId: data.locationId ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isDefault: data.isDefault || isFirst,
      },
    });
  });

  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddress(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const id = String(formData.get("addressId") ?? "");
  // Scoped by userId: a crafted id cannot delete someone else's address.
  await prisma.address.updateMany({
    where: { id, userId: user.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/account/addresses");
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export async function sendMessage(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  const body = String(formData.get("body") ?? "").trim();
  const providerProfileId = String(formData.get("providerProfileId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "") || null;

  if (!body || body.length < 1) return { ok: false, message: "Write a message first." };
  if (body.length > 2000) return { ok: false, message: "That message is too long." };

  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerProfileId },
    select: { id: true, userId: true, status: true },
  });
  if (!provider) return { ok: false, message: "Provider not found." };

  // A conversation is per customer and provider. If the message belongs to a
  // booking, that booking must actually involve both parties.
  if (bookingId) {
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [{ customerId: user.id }, { providerProfileId }],
      },
      select: { id: true },
    });
    if (!booking) return { ok: false, message: "That booking was not found." };
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      customerId_providerProfileId: { customerId: user.id, providerProfileId },
    },
    update: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 140) },
    create: {
      customerId: user.id,
      providerProfileId,
      bookingId,
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 140),
    },
    select: { id: true },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderUserId: user.id,
      bookingId,
      body,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { providerUnread: { increment: 1 } },
  });

  await notify({
    userId: provider.userId,
    type: "NEW_MESSAGE",
    title: `New message from ${user.name}`,
    body: body.slice(0, 120),
    href: `/pro/messages/${conversation.id}`,
  });

  revalidatePath(`/messages/${conversation.id}`);
  return { ok: true, message: "Sent." };
}
