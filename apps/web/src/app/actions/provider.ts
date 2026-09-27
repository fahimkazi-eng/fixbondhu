"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { latinSkeleton } from "@fixbondhu/core";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionBooking } from "@/lib/bookings";
import { notify } from "@/lib/notifications";
import { getSettingNumber } from "@/lib/settings";

/**
 * Provider mutations.
 *
 * The recurring pattern here is that every action loads the provider profile
 * from the session and then filters the target by its id. A provider who edits
 * a request body to name someone else's booking gets nothing, because the
 * lookup is `id: X, providerProfileId: <mine>`, not `id: X`.
 */

export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

async function requireProvider() {
  const user = await getCurrentUser();
  if (!user || !user.providerProfileId) return null;
  return { user, profileId: user.providerProfileId };
}

// ---------------------------------------------------------------------------
// Profile and onboarding
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter the name customers will see.").max(80),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
  businessName: z.string().trim().max(120).optional(),
  businessType: z.string().trim().max(80).optional(),
  tradeLicenseNo: z.string().trim().max(60).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60),
});

export async function saveProviderProfile(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    headline: formData.get("headline") || undefined,
    bio: formData.get("bio") || undefined,
    businessName: formData.get("businessName") || undefined,
    businessType: formData.get("businessType") || undefined,
    tradeLicenseNo: formData.get("tradeLicenseNo") || undefined,
    experienceYears: formData.get("experienceYears") || 0,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the form.", fieldErrors };
  }

  const d = parsed.data;
  const searchText = [d.displayName, d.businessName, d.headline, d.bio]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const searchSkeleton = latinSkeleton(searchText);

  await prisma.providerProfile.update({
    where: { id: context.profileId },
    data: {
      displayName: d.displayName,
      headline: d.headline ?? null,
      bio: d.bio ?? null,
      businessName: d.businessName ?? null,
      businessType: d.businessType ?? null,
      tradeLicenseNo: d.tradeLicenseNo ?? null,
      experienceYears: d.experienceYears,
      searchText,
      searchSkeleton: searchSkeleton || null,
    },
  });

  revalidatePath("/pro");
  revalidatePath("/pro/profile");
  return { ok: true, message: "Profile saved." };
}

/** Creates the profile for a signed-in customer who is becoming a provider. */
export async function startProviderOnboarding(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };
  if (user.providerProfileId) {
    return { ok: true, message: "You already have a provider profile." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: { displayName: "Enter the name customers will see." },
    };
  }

  const slugBase = displayName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "provider";

  // Slug must be unique; a collision appends a short suffix rather than
  // overwriting an existing provider.
  let slug = slugBase;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await prisma.providerProfile.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) break;
    slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
  }

  await prisma.providerProfile.create({
    data: {
      userId: user.id,
      slug,
      displayName,
      // DRAFT, never ACTIVE. An unverified provider must not be dispatchable,
      // so new supply cannot appear in search before a human has checked it.
      status: "DRAFT",
      searchText: displayName.toLowerCase(),
      searchSkeleton: latinSkeleton(displayName) || null,
    },
  });

  await prisma.userRoleAssignment.upsert({
    where: { userId_role: { userId: user.id, role: "PROVIDER" } },
    update: {},
    create: { userId: user.id, role: "PROVIDER" },
  });

  revalidatePath("/pro");
  return { ok: true, message: "Profile created. Add your services to continue." };
}

const serviceSchema = z
  .object({
    serviceId: z.string().min(1),
    priceMode: z.enum(["FIXED", "RANGE", "NEGOTIABLE"]),
    minPricePoisha: z.coerce.number().int().min(0, "Price cannot be negative.").max(100_000_000),
    maxPricePoisha: z.coerce.number().int().min(0).max(100_000_000),
    scopeNote: z.string().trim().max(200).optional(),
    minDurationMinutes: z.coerce.number().int().min(15).max(1440),
  })
  .refine((d) => d.minPricePoisha <= d.maxPricePoisha, {
    message: "The minimum price cannot be above the maximum.",
    path: ["maxPricePoisha"],
  });

export async function saveProviderService(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const parsed = serviceSchema.safeParse({
    serviceId: formData.get("serviceId"),
    priceMode: formData.get("priceMode"),
    minPricePoisha: formData.get("minPricePoisha"),
    maxPricePoisha: formData.get("maxPricePoisha"),
    scopeNote: formData.get("scopeNote") || undefined,
    minDurationMinutes: formData.get("minDurationMinutes") || 60,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the form.", fieldErrors };
  }

  const d = parsed.data;
  const serviceExists = await prisma.service.findUnique({
    where: { id: d.serviceId },
    select: { id: true },
  });
  if (!serviceExists) return { ok: false, message: "That service does not exist." };

  await prisma.providerService.upsert({
    where: {
      providerProfileId_serviceId: {
        providerProfileId: context.profileId,
        serviceId: d.serviceId,
      },
    },
    update: {
      priceMode: d.priceMode,
      minPricePoisha: d.minPricePoisha,
      maxPricePoisha: d.maxPricePoisha,
      basePricePoisha: d.priceMode === "FIXED" ? d.minPricePoisha : null,
      scopeNote: d.scopeNote ?? null,
      minDurationMinutes: d.minDurationMinutes,
      isActive: true,
    },
    create: {
      providerProfileId: context.profileId,
      serviceId: d.serviceId,
      priceMode: d.priceMode,
      minPricePoisha: d.minPricePoisha,
      maxPricePoisha: d.maxPricePoisha,
      basePricePoisha: d.priceMode === "FIXED" ? d.minPricePoisha : null,
      scopeNote: d.scopeNote ?? null,
      minDurationMinutes: d.minDurationMinutes,
    },
  });

  revalidatePath("/pro/services");
  return { ok: true, message: "Service saved." };
}

export async function saveServiceArea(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const locationId = String(formData.get("locationId") ?? "");
  if (!locationId) {
    return { ok: false, message: "Choose an area.", fieldErrors: { locationId: "Choose an area." } };
  }

  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) return { ok: false, message: "That area does not exist." };

  await prisma.providerServiceArea.upsert({
    where: { providerProfileId_locationId: { providerProfileId: context.profileId, locationId } },
    update: { isActive: true },
    create: {
      providerProfileId: context.profileId,
      locationId,
      isActive: true,
    },
  });

  revalidatePath("/pro/areas");
  return { ok: true, message: "Area added." };
}

export async function removeServiceArea(formData: FormData): Promise<void> {
  const context = await requireProvider();
  if (!context) return;

  await prisma.providerServiceArea.deleteMany({
    where: { id: String(formData.get("areaId") ?? ""), providerProfileId: context.profileId },
  });
  revalidatePath("/pro/areas");
}

export async function saveAvailability(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const weekday = Number(formData.get("weekday"));
  const startHour = Number(formData.get("startHour"));
  const endHour = Number(formData.get("endHour"));

  if (
    !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
    !Number.isInteger(startHour) || !Number.isInteger(endHour) ||
    startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24
  ) {
    return { ok: false, message: "Enter valid hours." };
  }
  if (endHour <= startHour) {
    return { ok: false, message: "The end time must be after the start time." };
  }

  await prisma.providerAvailability.upsert({
    where: {
      providerProfileId_weekday_startMinute_endMinute: {
        providerProfileId: context.profileId,
        weekday,
        startMinute: startHour * 60,
        endMinute: endHour * 60,
      },
    },
    update: { isActive: true },
    create: {
      providerProfileId: context.profileId,
      weekday,
      startMinute: startHour * 60,
      endMinute: endHour * 60,
      isActive: true,
    },
  });

  revalidatePath("/pro/availability");
  return { ok: true, message: "Availability saved." };
}

// ---------------------------------------------------------------------------
// Job handling
// ---------------------------------------------------------------------------

/**
 * Provider job transition.
 *
 * The only actor id used is the provider's own, resolved from the session, and
 * the booking lookup is scoped to their profile. Passing someone else's booking
 * id here achieves nothing.
 */
export async function providerTransition(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const bookingId = String(formData.get("bookingId") ?? "");
  const to = String(formData.get("to") ?? "");

  const allowed = [
    "ACCEPTED", "REJECTED", "ON_THE_WAY", "ARRIVED",
    "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW",
  ];
  if (!allowed.includes(to)) return { ok: false, message: "That action is not available." };

  const owned = await prisma.booking.findFirst({
    where: { id: bookingId, providerProfileId: context.profileId },
    select: { id: true },
  });
  if (!owned) return { ok: false, message: "That booking was not found." };

  const result = await transitionBooking({
    bookingId,
    to: to as never,
    actor: "PROVIDER",
    actorUserId: context.user.id,
    reason: String(formData.get("reason") ?? "").slice(0, 300) || undefined,
    // Cash is confirmed by the provider physically collecting it; that is the
    // real-world equivalent of a verified capture, and the state machine still
    // refuses a gateway payment that is not actually captured.
    waivePayment: true,
  });

  revalidatePath(`/pro/bookings/${bookingId}`);
  revalidatePath("/pro/requests");
  revalidatePath("/pro/jobs");

  return result.ok ? { ok: true, message: result.message } : { ok: false, message: result.message };
}

/**
 * Requests extra cost.
 *
 * This creates a request. It never changes the booking total. The total only
 * moves at completion, and only by summing APPROVED requests, so a provider
 * cannot raise a price by any other route.
 */
const chargeSchema = z.object({
  bookingId: z.string().min(1),
  amountPoisha: z.coerce.number().int().min(100, "The minimum additional charge is ৳1.").max(10_000_000),
  reason: z.string().trim().min(5, "Explain what the extra work is.").max(300),
});

export async function requestAdditionalCharge(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const parsed = chargeSchema.safeParse({
    bookingId: formData.get("bookingId"),
    amountPoisha: formData.get("amountPoisha"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the form.", fieldErrors };
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: parsed.data.bookingId,
      providerProfileId: context.profileId,
      status: { in: ["ARRIVED", "IN_PROGRESS"] },
    },
    select: { id: true, reference: true, customerId: true, totalPoisha: true },
  });
  if (!booking) {
    return { ok: false, message: "You can only request extra work once you have arrived." };
  }

  // One pending request at a time, so the customer is not asked twice.
  const pending = await prisma.additionalChargeRequest.findFirst({
    where: { bookingId: booking.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return { ok: false, message: "You already have a request awaiting a response." };

  await prisma.additionalChargeRequest.create({
    data: {
      bookingId: booking.id,
      requestedByUserId: context.user.id,
      amountPoisha: parsed.data.amountPoisha,
      reason: parsed.data.reason,
    },
  });

  await prisma.bookingEvent.create({
    data: {
      bookingId: booking.id,
      actor: "PROVIDER",
      actorUserId: context.user.id,
      type: "CHARGE_REQUESTED",
      summary: `Requested an additional ৳${(parsed.data.amountPoisha / 100).toFixed(0)}`,
      meta: { amountPoisha: parsed.data.amountPoisha, reason: parsed.data.reason },
    },
  });

  await notify({
    userId: booking.customerId,
    type: "ADDITIONAL_CHARGE_REQUESTED",
    title: "Additional charge requested",
    body: `Your provider is asking for an extra ৳${(parsed.data.amountPoisha / 100).toFixed(0)}: ${parsed.data.reason}`,
    href: `/bookings/${booking.id}`,
  });

  revalidatePath(`/pro/bookings/${booking.id}`);
  revalidatePath(`/bookings/${booking.id}`);
  return { ok: true, message: "Request sent. The customer must approve it before you continue." };
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export async function providerSendMessage(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const body = String(formData.get("body") ?? "").trim();
  const conversationId = String(formData.get("conversationId") ?? "");

  if (!body) return { ok: false, message: "Write a message first." };
  if (body.length > 2000) return { ok: false, message: "That message is too long." };

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, providerProfileId: context.profileId },
    select: { id: true, customerId: true },
  });
  if (!conversation) return { ok: false, message: "Conversation not found." };

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderUserId: context.user.id,
      body,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 140),
      customerUnread: { increment: 1 },
    },
  });

  await notify({
    userId: conversation.customerId,
    type: "NEW_MESSAGE",
    title: `Message from ${context.user.name}`,
    body: body.slice(0, 120),
    href: `/messages/${conversation.id}`,
  });

  revalidatePath(`/pro/messages/${conversation.id}`);
  return { ok: true, message: "Sent." };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Submits verification documents.
 *
 * Document upload is not implemented, so this records the request with a
 * placeholder reference and the provider stays PENDING. It deliberately does
 * NOT mark anything approved, and no badge appears until an administrator acts.
 */
export async function submitVerification(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireProvider();
  if (!context) return { ok: false, message: "Sign in as a provider." };

  const type = String(formData.get("type") ?? "");
  if (!["IDENTITY", "BUSINESS", "CERTIFICATE"].includes(type)) {
    return { ok: false, message: "Choose what you are verifying." };
  }

  const existing = await prisma.providerVerification.findFirst({
    where: { providerProfileId: context.profileId, type: type as never, status: "PENDING" },
    select: { id: true },
  });
  if (existing) return { ok: false, message: "That verification is already under review." };

  await prisma.providerVerification.create({
    data: {
      providerProfileId: context.profileId,
      type: type as never,
      status: "PENDING",
      documentMeta: {
        note: String(formData.get("note") ?? "").slice(0, 500) || null,
        submittedVia: "portal",
        documentsUploaded: 0,
      } as never,
    },
  });

  // First submission moves the profile into review, never straight to ACTIVE.
  const profile = await prisma.providerProfile.findUnique({
    where: { id: context.profileId },
    select: { status: true },
  });
  if (profile?.status === "DRAFT") {
    await prisma.providerProfile.update({
      where: { id: context.profileId },
      data: { status: "PENDING_REVIEW", verificationSubmittedAt: new Date() },
    });
  }

  revalidatePath("/pro/verification");
  return { ok: true, message: "Submitted for review. An administrator will check this." };
}

/** Recomputes the provider's response rate from real booking data. */
export async function refreshProviderStats(profileId: string): Promise<void> {
  const [requests, accepted] = await Promise.all([
    prisma.booking.count({ where: { providerProfileId: profileId, status: { not: "REQUESTED" } } }),
    prisma.booking.count({
      where: {
        providerProfileId: profileId,
        status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED"] },
      },
    }),
  ]);

  await prisma.providerProfile.update({
    where: { id: profileId },
    data: { responseRate: requests > 0 ? Number((accepted / requests).toFixed(3)) : 0 },
  });
}

export async function getDefaultResponseMinutes(): Promise<number> {
  return getSettingNumber("booking.providerResponseMinutes", 30);
}
