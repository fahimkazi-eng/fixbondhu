"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasEveryPermission, applyCommissionBps } from "@fixbondhu/core";

import { getCurrentUser } from "@/lib/session";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { transitionBooking } from "@/lib/bookings";
import { notify } from "@/lib/notifications";
import { setSetting, invalidateSettings } from "@/lib/settings";
import { getGateway } from "@/lib/payments/gateway";

/**
 * Administrative actions.
 *
 * requireStaff() runs first in every action, so a customer session cannot
 * reach any of them regardless of what the request contains. Where a role is
 * insufficient for a specific operation the action checks the permission
 * explicitly, because a SUPPORT agent legitimately reaches this file but must
 * not be able to issue a refund.
 */

export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

async function audit(input: {
  userId: string;
  role: string;
  action:
    | "CREATE" | "UPDATE" | "APPROVE" | "REJECT" | "SUSPEND" | "RESTORE"
    | "REFUND" | "PAYOUT" | "RESOLVE" | "SETTINGS_UPDATE" | "ROLE_CHANGE";
  entityType: string;
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.userId,
      actorRole: input.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      before: (input.before ?? null) as never,
      after: (input.after ?? null) as never,
      ip: input.ip ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const verificationSchema = z.object({
  verificationId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Approving or rejecting a verification.
 *
 * When every required verification is approved the provider becomes ACTIVE,
 * which is what makes them bookable. That transition is computed from the
 * verification rows rather than set by hand, so a badge and bookability can
 * never disagree.
 */
export async function decideVerification(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireStaff("provider:verify");
  if (!hasEveryPermission(admin.roles, ["provider:verify"])) {
    return { ok: false, message: "Your role cannot decide verifications." };
  }

  const parsed = verificationSchema.safeParse({
    verificationId: formData.get("verificationId"),
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const verification = await prisma.providerVerification.findUnique({
    where: { id: parsed.data.verificationId },
    include: { providerProfile: { select: { id: true, userId: true, displayName: true } } },
  });
  if (!verification) return { ok: false, message: "Verification not found." };
  if (verification.status !== "PENDING") {
    return { ok: false, message: "That verification has already been decided." };
  }
  if (parsed.data.decision === "REJECTED" && !parsed.data.reason) {
    return {
      ok: false,
      message: "Please explain the rejection.",
      fieldErrors: { reason: "A reason is required when rejecting." },
    };
  }

  await prisma.providerVerification.update({
    where: { id: verification.id },
    data: {
      status: parsed.data.decision,
      reviewedByUserId: admin.id,
      reviewedAt: new Date(),
      rejectionReason: parsed.data.decision === "REJECTED" ? (parsed.data.reason ?? null) : null,
    },
  });

  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: parsed.data.decision === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "ProviderVerification",
    entityId: verification.id,
    summary: `${parsed.data.decision} ${verification.type} for ${verification.providerProfile.displayName}`,
    before: { status: verification.status },
    after: { status: parsed.data.decision, reason: parsed.data.reason ?? null },
  });

  // Approval is what makes a provider bookable, and it is derived from the rows.
  const all = await prisma.providerVerification.findMany({
    where: { providerProfileId: verification.providerProfile.id },
    select: { type: true, status: true },
  });
  const hasIdentity = all.some((v) => v.type === "IDENTITY" && v.status === "APPROVED");
  const hasPhone = all.some((v) => v.type === "PHONE" && v.status === "APPROVED");
  const hasBusinessOrCertificate =
    all.some((v) => v.type === "BUSINESS" && v.status === "APPROVED") ||
    all.some((v) => v.type === "CERTIFICATE" && v.status === "APPROVED");
  const anyRejected = all.some((v) => v.status === "REJECTED");

  const profile = await prisma.providerProfile.findUnique({
    where: { id: verification.providerProfile.id },
    select: { status: true },
  });

  if (profile?.status === "PENDING_REVIEW" || profile?.status === "REJECTED") {
    if (hasIdentity && hasBusinessOrCertificate) {
      await prisma.providerProfile.update({
        where: { id: verification.providerProfile.id },
        data: { status: "ACTIVE", approvedAt: new Date(), rejectionReason: null },
      });
    } else if (anyRejected) {
      await prisma.providerProfile.update({
        where: { id: verification.providerProfile.id },
        data: { status: "REJECTED", rejectionReason: parsed.data.reason ?? "Verification rejected" },
      });
    }
  }

  await notify({
    userId: verification.providerProfile.userId,
    type: parsed.data.decision === "APPROVED" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
    title: parsed.data.decision === "APPROVED" ? "Verification approved" : "Verification rejected",
    body:
      parsed.data.decision === "APPROVED"
        ? `Your ${verification.type.toLowerCase()} verification was approved.`
        : `Your ${verification.type.toLowerCase()} verification was rejected: ${parsed.data.reason}`,
    href: "/pro/verification",
  });

  revalidatePath("/admin/verification");
  revalidatePath("/admin/providers");
  revalidatePath("/pro/verification");

  return {
    ok: true,
    message: parsed.data.decision === "APPROVED" ? "Approved." : "Rejected.",
  };
}

export async function setProviderStatus(formData: FormData): Promise<void> {
  const admin = await requireStaff("provider:suspend");
  const profileId = String(formData.get("profileId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["ACTIVE", "SUSPENDED", "DEACTIVATED"].includes(status)) return;

  await prisma.providerProfile.update({
    where: { id: profileId },
    data: { status: status as never },
  });

  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: status === "ACTIVE" ? "RESTORE" : "SUSPEND",
    entityType: "ProviderProfile",
    entityId: profileId,
    summary: `Status set to ${status}`,
    after: { status },
  });

  revalidatePath("/admin/providers");
}

// ---------------------------------------------------------------------------
// Complaints and disputes
// ---------------------------------------------------------------------------

export async function resolveComplaint(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireStaff("complaint:manage");
  if (!hasEveryPermission(admin.roles, ["complaint:manage"])) {
    return { ok: false, message: "Your role cannot resolve complaints." };
  }

  const complaintId = String(formData.get("complaintId") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();
  const resolutionType = String(formData.get("resolutionType") ?? "");

  if (!complaintId || resolution.length < 5) {
    return { ok: false, message: "Please record what was decided." };
  }

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: { dispute: { select: { id: true, bookingId: true, claimAmountPoisha: true } } },
  });
  if (!complaint) return { ok: false, message: "Complaint not found." };

  const refundTypes = ["REFUND_FULL", "REFUND_PARTIAL"];

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: complaintId },
      data: {
        status: resolutionType === "NO_REFUND" ? "REJECTED" : "RESOLVED",
        resolution,
        resolutionType: resolutionType as never,
        resolvedAt: new Date(),
        assignedToUserId: complaint.assignedToUserId ?? admin.id,
      },
    });

    await tx.complaintEvent.create({
      data: {
        complaintId,
        actorUserId: admin.id,
        actorRole: admin.roles.join(","),
        type: "RESOLVED",
        note: `${resolutionType}: ${resolution}`,
        meta: { resolutionType },
      },
    });

    if (complaint.dispute) {
      await tx.dispute.update({
        where: { id: complaint.dispute.id },
        data: {
          status: refundTypes.includes(resolutionType) ? "RESOLVED" : "DISMISSED",
          decision: resolution,
          decidedByUserId: admin.id,
          decidedAt: new Date(),
          closedAt: new Date(),
          awardedAmountPoisha: resolutionType === "REFUND_FULL"
            ? complaint.dispute.claimAmountPoisha
            : 0,
        },
      });
    }
  });

  if (refundTypes.includes(resolutionType) && complaint.bookingId) {
    const payments = await prisma.payment.findMany({
      where: { bookingId: complaint.bookingId, status: "CAPTURED" },
      select: { id: true, amountPoisha: true, refundedPoisha: true, gatewayPaymentId: true },
    });

    for (const payment of payments) {
      const refundable = payment.amountPoisha - payment.refundedPoisha;
      if (refundable <= 0) continue;
      // Without a gateway id there is nothing to send the refund through. The
      // row is skipped rather than marked refunded, so the money stays visibly
      // outstanding instead of silently disappearing.
      if (!payment.gatewayPaymentId) continue;

      const result = await getGateway().refund(
        payment.gatewayPaymentId,
        refundable,
        resolution.slice(0, 40),
      );

      if (result.ok) {
        await prisma.$transaction(async (tx) => {
          await tx.refund.create({
            data: {
              paymentId: payment.id,
              amountPoisha: refundable,
              reason: resolution.slice(0, 200),
              status: "CAPTURED",
              gatewayRefundId: result.gatewayRefundId ?? null,
              processedByUserId: admin.id,
              processedAt: new Date(),
            },
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              refundedPoisha: { increment: refundable },
              status: refundable >= payment.amountPoisha ? "REFUNDED" : "PARTIALLY_REFUNDED",
            },
          });
        });
      }
    }
  }

  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: "RESOLVE",
    entityType: "Complaint",
    entityId: complaintId,
    summary: `Resolved as ${resolutionType}`,
    after: { resolutionType, resolution },
  });

  await notify({
    userId: complaint.customerId,
    type: "DISPUTE_UPDATED",
    title: "Your complaint was resolved",
    body: resolution.slice(0, 200),
    href: `/support/complaints/${complaint.reference}`,
  });

  revalidatePath("/admin/complaints");
  revalidatePath(`/admin/complaints/${complaintId}`);

  return { ok: true, message: "Complaint resolved and the decision logged." };
}

export async function assignComplaint(formData: FormData): Promise<void> {
  const admin = await requireStaff("complaint:manage");
  await prisma.complaint.update({
    where: { id: String(formData.get("complaintId") ?? "") },
    data: {
      assignedToUserId: String(formData.get("assigneeId") ?? "") || null,
      status: "IN_REVIEW",
    },
  });
  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: "UPDATE",
    entityType: "Complaint",
    entityId: String(formData.get("complaintId") ?? ""),
    summary: "Assigned complaint",
  });
  revalidatePath("/admin/complaints");
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

/**
 * Builds a payout from captured payments.
 *
 * Money only ever enters a payout from Payment rows with status CAPTURED, and
 * each payment is linked through PayoutItem, so a payment cannot be paid out
 * twice: the unique constraint on (payoutId, paymentId) plus the status filter
 * make a second sweep a no-op.
 */
export async function generatePayouts(
  _prev: ActionState | null,
  _formData: FormData,
): Promise<ActionState> {
  const admin = await requireStaff("payout:manage");
  if (!hasEveryPermission(admin.roles, ["payout:manage"])) {
    return { ok: false, message: "Your role cannot generate payouts." };
  }

  const providers = await prisma.providerProfile.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, displayName: true },
  });

  let created = 0;
  let totalPoisha = 0;

  for (const provider of providers) {
    // Payments not yet attached to any payout.
    const payments = await prisma.payment.findMany({
      where: {
        providerProfileId: provider.id,
        status: "CAPTURED",
        payoutItems: { none: {} },
      },
      select: { id: true, providerAmountPoisha: true, commissionPoisha: true },
      take: 500,
    });
    if (payments.length === 0) continue;

    const gross = payments.reduce((s, p) => s + p.providerAmountPoisha, 0);
    const commission = payments.reduce((s, p) => s + p.commissionPoisha, 0);
    const net = payments.reduce((s, p) => s + p.providerAmountPoisha, 0);

    const reference = `PO-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;

    await prisma.payout.create({
      data: {
        reference,
        providerProfileId: provider.id,
        periodStart: new Date(Date.now() - 30 * 24 * 3_600_000),
        periodEnd: new Date(),
        grossPoisha: gross,
        commissionPoisha: commission,
        netPoisha: net,
        status: "PENDING",
        items: {
          create: payments.map((p) => ({ paymentId: p.id, amountPoisha: p.providerAmountPoisha })),
        },
      },
    });

    await audit({
      userId: admin.id,
      role: admin.roles.join(","),
      action: "PAYOUT",
      entityType: "Payout",
      entityId: reference,
      summary: `Generated payout for ${provider.displayName}: ৳${(net / 100).toFixed(2)} across ${payments.length} payments`,
    });

    created += 1;
    totalPoisha += net;
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/payouts");

  return {
    ok: true,
    message:
      created === 0
        ? "No uncaptured-earnings payments were found. Nothing to pay out yet."
        : `Created ${created} payout${created === 1 ? "" : "s"} totalling ৳${(totalPoisha / 100).toFixed(2)}.`,
  };
}

export async function approvePayout(formData: FormData): Promise<void> {
  const admin = await requireStaff("payout:approve");
  const payoutId = String(formData.get("payoutId") ?? "");

  await prisma.payout.update({
    where: { id: payoutId },
    data: { status: "APPROVED", processedByUserId: admin.id, processedAt: new Date() },
  });

  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: "PAYOUT",
    entityType: "Payout",
    entityId: payoutId,
    summary: "Payout approved",
  });

  revalidatePath("/admin/payouts");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSetting(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireStaff("settings:manage");
  if (!hasEveryPermission(admin.roles, ["settings:manage"])) {
    return { ok: false, message: "Your role cannot change platform settings." };
  }

  const key = String(formData.get("key") ?? "");
  const raw = String(formData.get("value") ?? "");

  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    return { ok: false, message: "That setting key is not valid." };
  }

  let value: unknown = raw;
  if (raw === "true" || raw === "false") {
    value = raw === "true";
  } else if (raw !== "" && !Number.isNaN(Number(raw))) {
    value = Number(raw);
  } else if (raw.startsWith("[")) {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, message: "That value is not valid JSON." };
    }
  }

  const before = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  await setSetting(key, value, admin.id);
  invalidateSettings();

  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: "SETTINGS_UPDATE",
    entityType: "Setting",
    entityId: key,
    summary: `Changed ${key}`,
    before: before?.value,
    after: value,
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: `${key} updated.` };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

const couponSchema = z.object({
  code: z.string().trim().min(3).max(24).regex(/^[A-Z0-9-]+$/i, "Use letters, numbers and dashes only."),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().min(1),
  maxDiscountPoisha: z.coerce.number().int().min(0).optional(),
  minOrderPoisha: z.coerce.number().int().min(0).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  maxRedemptions: z.coerce.number().int().min(1).optional(),
  description: z.string().trim().max(200).optional(),
});

export async function createCoupon(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireStaff("coupon:manage");
  if (!hasEveryPermission(admin.roles, ["coupon:manage"])) {
    return { ok: false, message: "Your role cannot create coupons." };
  }

  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    maxDiscountPoisha: formData.get("maxDiscountPoisha") || undefined,
    minOrderPoisha: formData.get("minOrderPoisha") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    maxRedemptions: formData.get("maxRedemptions") || undefined,
    description: formData.get("description") || undefined,
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
  if (new Date(d.endsAt) <= new Date(d.startsAt)) {
    return { ok: false, message: "The end date must be after the start date." };
  }

  const code = d.code.toUpperCase();
  const existing = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
  if (existing) return { ok: false, message: "That code already exists." };

  await prisma.coupon.create({
    data: {
      code,
      type: d.type,
      value: d.value,
      maxDiscountPoisha: d.maxDiscountPoisha ?? null,
      minOrderPoisha: d.minOrderPoisha ?? null,
      startsAt: new Date(d.startsAt),
      endsAt: new Date(d.endsAt),
      maxRedemptions: d.maxRedemptions ?? null,
      description: d.description ?? null,
    },
  });

  await audit({
    userId: admin.id,
    role: admin.roles.join(","),
    action: "CREATE",
    entityType: "Coupon",
    entityId: code,
    summary: `Created coupon ${code}`,
  });

  revalidatePath("/admin/content");
  return { ok: true, message: `Coupon ${code} created.` };
}

export async function adminTransitionBooking(formData: FormData): Promise<void> {
  const admin = await requireStaff("booking:manage");
  await transitionBooking({
    bookingId: String(formData.get("bookingId") ?? ""),
    to: String(formData.get("to") ?? "DISPUTED") as never,
    actor: "ADMIN",
    actorUserId: admin.id,
    reason: String(formData.get("reason") ?? "Administrative action") || undefined,
    waivePayment: true,
  });
  revalidatePath("/admin/bookings");
}

export { getCurrentUser, applyCommissionBps };
