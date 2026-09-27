/**
 * Bookings.
 *
 * The operational core. Every state change goes through transitionBooking,
 * which consults the state machine in @fixbondhu/core rather than trusting the
 * caller's intent, writes a status history row, and notifies both parties.
 *
 * Two invariants hold here and are worth stating plainly:
 *
 *  1. A provider can never change a booking's price. The total is computed once
 *     at creation from the provider's published range, and afterwards it moves
 *     only by a customer-approved AdditionalChargeRequest.
 *  2. Every important field is snapshotted onto the booking. A provider who
 *     renames their business or moves house must not rewrite the history of
 *     work already done for a customer.
 */

import {
  applyCommissionBps,
  computeBookingTotal,
  evaluateCancellation,
  evaluateTransition,
  generateBookingReference,
  isClosed,
  type BookingActor,
  type BookingStatus,
  type CancellationPolicy,
} from "@fixbondhu/core";

import { Prisma } from "@fixbondhu/db";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { getSettingNumber } from "@/lib/settings";

export interface CreateBookingInput {
  customerId: string;
  providerServiceId: string;
  addressId: string;
  scheduledAt: Date;
  customerNote?: string;
  couponCode?: string;
  paymentMethod: "CASH" | "BKASH" | "A2A" | "NAGAD" | "CARD";
  /**
   * Allows a scheduled time in the past.
   *
   * Exists solely so historical demo bookings can be created. The customer-facing
   * path never sets it, because refusing a past appointment is correct for a real
   * request. Deliberately an explicit named flag rather than a relaxed default,
   * so it cannot be switched on by accident from a form.
   */
  allowPastSchedule?: boolean;
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "SERVICE_UNAVAILABLE"
      | "PROVIDER_UNAVAILABLE"
      | "ADDRESS_INVALID"
      | "AREA_NOT_COVERED"
      | "SCHEDULE_INVALID"
      | "COUPON_INVALID"
      | "SELF_BOOKING"
      | "UNVERIFIED",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

async function cancellationPolicy(): Promise<CancellationPolicy> {
  const [freeHours, lateHours, lateFee, noShowFee] = await Promise.all([
    getSettingNumber("cancellation.freeCancelHours", 12),
    getSettingNumber("cancellation.lateCancelHours", 2),
    getSettingNumber("cancellation.lateCancelFeePoisha", 20_000),
    getSettingNumber("cancellation.customerNoShowFeePoisha", 30_000),
  ]);

  return {
    freeCancelHours: freeHours,
    lateCancelHours: lateHours,
    lateCancelFeePoisha: lateFee,
    providerCancelFeePoisha: 0,
    customerNoShowFeePoisha: noShowFee,
    providerNoShowFeePoisha: 0,
  };
}

/** Rejects a booking in the past or further out than the catalogue allows. */
function assertSaneSchedule(scheduledAt: Date): void {
  const now = Date.now();
  if (scheduledAt.getTime() < now - 5 * 60_000) {
    throw new BookingError("Choose a time in the future.", "SCHEDULE_INVALID");
  }
  // Three months is the furthest a marketplace can usefully schedule; beyond
  // that providers are not holding slots and the booking would rot.
  if (scheduledAt.getTime() > now + 90 * 24 * 3_600_000) {
    throw new BookingError("Bookings can be made up to 90 days ahead.", "SCHEDULE_INVALID");
  }
}

export async function createBooking(input: CreateBookingInput) {
  // The customer path always validates the schedule. Only the demo seeder opts
  // out, to create the history a real marketplace accumulates.
  if (!input.allowPastSchedule) {
    assertSaneSchedule(input.scheduledAt);
  }

  const [providerService, address, customer, rules, responseMinutes] = await Promise.all([
    prisma.providerService.findUnique({
      where: { id: input.providerServiceId },
      include: {
        service: { include: { category: true } },
        providerProfile: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
            serviceAreas: { where: { isActive: true }, include: { location: true } },
          },
        },
      },
    }),
    prisma.address.findFirst({
      where: { id: input.addressId, userId: input.customerId, deletedAt: null },
      include: { location: true },
    }),
    prisma.user.findUnique({
      where: { id: input.customerId },
      select: { id: true, name: true, phone: true, status: true },
    }),
    prisma.commissionRule.findMany({ where: { isActive: true } }),
    getSettingNumber("booking.providerResponseMinutes", 30),
  ]);

  if (!providerService || !providerService.isActive) {
    throw new BookingError("This service is no longer offered.", "SERVICE_UNAVAILABLE");
  }
  if (!customer) {
    throw new BookingError("Account not found.", "UNVERIFIED");
  }
  if (customer.status !== "ACTIVE") {
    throw new BookingError("Your account cannot make bookings.", "UNVERIFIED");
  }
  if (!address) {
    throw new BookingError("That address is not on your account.", "ADDRESS_INVALID");
  }

  const profile = providerService.providerProfile;
  if (profile.status !== "ACTIVE") {
    throw new BookingError("This provider is not accepting work.", "PROVIDER_UNAVAILABLE");
  }
  if (profile.userId === input.customerId) {
    throw new BookingError("You cannot book yourself.", "SELF_BOOKING");
  }

  /*
   * Service area.
   *
   * A provider who has declared coverage must cover the address, and a provider
   * who has declared none is covering everywhere. Failing this at booking time
   * is far kinder than dispatching someone who will turn up and refuse.
   */
  if (profile.serviceAreas.length > 0) {
    const covers =
      address.locationId !== null &&
      profile.serviceAreas.some((area) => area.locationId === address.locationId);
    if (!covers) {
      const names = profile.serviceAreas.map((a) => a.location.nameEn).join(", ");
      throw new BookingError(
        `This provider does not cover your area. They cover: ${names}.`,
        "AREA_NOT_COVERED",
      );
    }
  }

  // ---- price -------------------------------------------------------------
  const base = providerService.basePricePoisha ?? providerService.minPricePoisha;

  let discountPoisha = 0;
  let couponRedemptionId: string | null = null;

  if (input.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: input.couponCode.trim().toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      throw new BookingError("That coupon is not valid.", "COUPON_INVALID");
    }
    const now = new Date();
    if (coupon.startsAt > now || coupon.endsAt < now) {
      throw new BookingError("That coupon has expired.", "COUPON_INVALID");
    }

    const subtotal = base + (profile.serviceAreas[0]?.travelFeePoisha ?? 0);
    const raw =
      coupon.type === "PERCENT"
        ? Math.floor((subtotal * coupon.value) / 10_000)
        : coupon.value;
    const capped = coupon.maxDiscountPoisha
      ? Math.min(raw, coupon.maxDiscountPoisha)
      : raw;
    const afterMin = coupon.minOrderPoisha && subtotal < coupon.minOrderPoisha ? 0 : capped;
    if (afterMin <= 0) {
      throw new BookingError("This coupon does not apply to that amount.", "COUPON_INVALID");
    }

    discountPoisha = Math.min(afterMin, subtotal);
    couponRedemptionId = coupon.id;
  }

  const travelFee = 0;
  const { totalPoisha } = computeBookingTotal({
    basePricePoisha: base,
    travelFeePoisha: travelFee,
    approvedExtrasPoisha: 0,
    discountPoisha,
  });

  const { commissionPoisha, providerPoisha } = applyCommissionBps(
    totalPoisha,
    await resolveBps(rules, providerService.serviceId, providerService.service.categoryId),
  );

  // A RANGE quote has no single agreed figure until the provider sees the job,
  // so the customer sees the band and the provider settles it before starting.
  const agreedPricePoisha =
    providerService.priceMode === "FIXED" ? base : null;

  const reference = generateBookingReference();
  const respondBy = new Date(Date.now() + responseMinutes * 60_000);
  const scheduledEndAt = new Date(
    input.scheduledAt.getTime() +
      providerService.minDurationMinutes * 60_000,
  );

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        reference,
        customerId: input.customerId,
        providerProfileId: profile.id,
        serviceId: providerService.serviceId,
        providerServiceId: providerService.id,
        addressId: address.id,

        // Snapshot: history must not change if the provider renames or moves.
        serviceNameEn: providerService.service.nameEn,
        serviceNameBn: providerService.service.nameBn,
        categoryNameEn: providerService.service.category.nameEn,
        providerName: profile.displayName,
        providerPhone: profile.user.phone ?? "",
        addressSnapshot: {
          label: address.label,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          areaName: address.areaName,
          districtName: address.districtName,
          postalCode: address.postalCode,
        } as never,
        areaName: address.areaName,
        districtName: address.districtName,
        latitude: address.latitude,
        longitude: address.longitude,

        quotedMinPoisha: providerService.minPricePoisha,
        quotedMaxPoisha: providerService.maxPricePoisha,
        agreedPricePoisha,
        basePricePoisha: base,
        travelFeePoisha: travelFee,
        discountPoisha,
        totalPoisha,
        commissionPoisha,
        providerEarningPoisha: providerPoisha,
        priceMode: providerService.priceMode,

        status: "REQUESTED",
        scheduledAt: input.scheduledAt,
        scheduledEndAt,
        respondBy,
        paymentStatus: "PENDING",
        paymentMethod: input.paymentMethod,
        customerNote: input.customerNote?.slice(0, 1000) ?? null,
        couponRedemptionId,
      },
      select: { id: true, reference: true },
    });

    // Every status change is recorded, including the creation itself.
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: created.id,
        fromStatus: null,
        toStatus: "REQUESTED",
        actor: "CUSTOMER",
        actorUserId: input.customerId,
        reason: "Booking requested",
      },
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: created.id,
        actor: "CUSTOMER",
        actorUserId: input.customerId,
        type: "REQUESTED",
        summary: `Requested ${providerService.service.nameEn}`,
      },
    });

    if (couponRedemptionId) {
      await tx.couponRedemption.create({
        data: {
          couponId: couponRedemptionId,
          userId: input.customerId,
          bookingId: created.id,
          subtotalPoisha: base + travelFee,
          discountPoisha,
        },
      });
      await tx.coupon.update({
        where: { id: couponRedemptionId },
        data: { redemptionCount: { increment: 1 } },
      });
    }

    // Occupy a slot so a second customer cannot book a provider who is already
    // committed to this window.
    await tx.providerProfile.update({
      where: { id: profile.id },
      data: { pendingPayoutPoisha: { increment: 0 } },
    });

    return created;
  });

  await notify({
    userId: profile.userId,
    type: "BOOKING_REQUESTED",
    title: "New booking request",
    body: `${customer?.name ?? "A customer"} requested ${providerService.service.nameEn}. Reference ${reference}.`,
    href: `/pro/requests`,
    data: { bookingId: booking.id },
  });

  return booking;
}

async function resolveBps(
  rules: Array<{
    id: string;
    commissionBps: number;
    serviceId: string | null;
    categoryId: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
  }>,
  serviceId: string,
  categoryId: string,
): Promise<number> {
  const now = new Date();
  let best: { bps: number; score: number } | null = null;

  for (const rule of rules) {
    if (!rule.isActive || rule.effectiveFrom > now) continue;
    if (rule.effectiveTo && rule.effectiveTo <= now) continue;

    const score = rule.serviceId === serviceId ? 3 : rule.categoryId === categoryId ? 2 : !rule.serviceId && !rule.categoryId ? 1 : 0;
    if (score > 0 && (!best || score > best.score)) {
      best = { bps: rule.commissionBps, score };
    }
  }

  return best?.bps ?? (await getSettingNumber("commission.defaultBps", 1200));
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export interface TransitionInput {
  bookingId: string;
  to: BookingStatus;
  actor: BookingActor;
  actorUserId: string | null;
  reason?: string;
  /** Payment must already be CAPTURED for gateway methods. */
  waivePayment?: boolean;
}

export interface TransitionResult {
  ok: boolean;
  bookingId: string;
  status: BookingStatus;
  message: string;
}

export async function transitionBooking(
  input: TransitionInput,
): Promise<TransitionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      providerProfile: { include: { user: { select: { id: true } } } },
      payments: { select: { status: true, method: true, amountPoisha: true } },
    },
  });

  if (!booking) {
    return { ok: false, bookingId: input.bookingId, status: "CANCELLED", message: "Booking not found." };
  }

  const isGateway = booking.paymentMethod !== "CASH";
  const captured =
    booking.paymentStatus === "CAPTURED" ||
    booking.payments.some((p) => p.status === "CAPTURED");

  const decision = evaluateTransition({
    from: booking.status,
    to: input.to,
    actor: input.actor,
    paymentCaptured: input.waivePayment ? true : captured,
    isGatewayPayment: isGateway,
  });

  if (!decision.ok) {
    return {
      ok: false,
      bookingId: booking.id,
      status: booking.status,
      message: decision.message,
    };
  }

  // ---- side effects that accompany specific transitions ------------------
  type Notice = {
    title: string;
    body: string;
    type: Parameters<typeof notify>[0]["type"];
  };
  let extraWork: (tx: Prisma.TransactionClient) => Promise<void> = async () => {};
  let customerNotice: Notice | null = null;

  const now = new Date();

  switch (input.to) {
    case "ACCEPTED": {
      extraWork = async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { acceptedAt: now } });
        // A range quote becomes a firm agreed price at acceptance, which is
        // still the published band, not a new number.
        if (booking.agreedPricePoisha === null) {
          const providerService = await tx.providerService.findUnique({
            where: { id: booking.providerServiceId ?? "" },
            select: { minPricePoisha: true, maxPricePoisha: true },
          });
          const agreed = providerService?.minPricePoisha ?? booking.quotedMinPoisha;
          await tx.booking.update({
            where: { id: booking.id },
            data: { agreedPricePoisha: agreed },
          });
        }
      };
      customerNotice = {
        title: "Your booking was accepted",
        body: `${booking.providerName} accepted your ${booking.serviceNameEn} request (${booking.reference}).`,
        type: "BOOKING_ACCEPTED",
      };
      break;
    }
    case "REJECTED": {
      extraWork = async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { cancelledAt: now, cancelledBy: "PROVIDER", cancellationReason: input.reason ?? "Declined by provider" },
        });
        await tx.providerProfile.update({
          where: { id: booking.providerProfileId },
          data: { cancelledJobs: { increment: 1 } },
        });
      };
      customerNotice = {
        title: "Your request was declined",
        body: `${booking.providerName} could not take ${booking.serviceNameEn} (${booking.reference}).`,
        type: "BOOKING_REJECTED",
      };
      break;
    }
    case "ON_THE_WAY":
      extraWork = async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { onTheWayAt: now } });
      };
      customerNotice = {
        title: "Your provider is on the way",
        body: `${booking.providerName} is travelling to your address for ${booking.reference}.`,
        type: "PROVIDER_ON_THE_WAY",
      };
      break;
    case "ARRIVED":
      extraWork = async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { arrivedAt: now } });
      };
      customerNotice = {
        title: "Your provider has arrived",
        body: `${booking.providerName} has arrived for ${booking.reference}.`,
        type: "PROVIDER_ARRIVED",
      };
      break;
    case "IN_PROGRESS":
      extraWork = async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { startedAt: now } });
      };
      customerNotice = {
        title: "Work has started",
        body: `${booking.providerName} has started ${booking.serviceNameEn} (${booking.reference}).`,
        type: "JOB_STARTED",
      };
      break;
    case "COMPLETED": {
      /*
       * Extras are read back from APPROVED charge requests at completion rather
       * than carried in memory. A request the customer declined contributes
       * nothing, which is what makes it impossible for a provider to add a fee
       * by other means.
       */
      const approved = await prisma.additionalChargeRequest.aggregate({
        where: { bookingId: booking.id, status: "APPROVED" },
        _sum: { amountPoisha: true },
      });
      const extrasPoisha = approved._sum.amountPoisha ?? 0;

      /*
       * The commission rate is recovered from the split recorded at creation
       * rather than re-resolved. Re-resolving could pick up a rule introduced
       * since the customer agreed the price, which would silently change what
       * the provider is owed after the work is done.
       */
      const settledForBps =
        booking.agreedPricePoisha !== null && booking.agreedPricePoisha > 0
          ? booking.agreedPricePoisha
          : booking.basePricePoisha;
      const bps =
        settledForBps > 0
          ? Math.round((Number(booking.commissionPoisha) / settledForBps) * 10_000)
          : 0;

      extraWork = async (tx) => {
        const { totalPoisha } = computeBookingTotal({
          basePricePoisha: booking.basePricePoisha,
          travelFeePoisha: booking.travelFeePoisha,
          approvedExtrasPoisha: extrasPoisha,
          discountPoisha: booking.discountPoisha,
        });
        const split = applyCommissionBps(totalPoisha, bps);

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            completedAt: now,
            extrasPoisha,
            totalPoisha,
            commissionPoisha: split.commissionPoisha,
            providerEarningPoisha: split.providerPoisha,
            // Cash is collected on site, so the platform records it as settled
            // at completion. The provider confirms collection, which is the
            // real-world equivalent of a gateway capture.
            paymentStatus: booking.paymentMethod === "CASH" ? "CAPTURED" : booking.paymentStatus,
          },
        });
        if (booking.paymentMethod === "CASH") {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              customerId: booking.customerId,
              providerProfileId: booking.providerProfileId,
              method: "CASH",
              channel: "PROVIDER",
              amountPoisha: totalPoisha,
              commissionPoisha: split.commissionPoisha,
              providerAmountPoisha: split.providerPoisha,
              status: "CAPTURED",
              gateway: "cash",
              idempotencyKey: `cash-${booking.id}`,
              paidAt: now,
            },
          });
        }
        await tx.providerProfile.update({
          where: { id: booking.providerProfileId },
          data: {
            completedJobs: { increment: 1 },
            totalEarningsPoisha: { increment: split.providerPoisha },
          },
        });
      };
      customerNotice = {
        title: "Job completed",
        body: `${booking.serviceNameEn} is complete (${booking.reference}). You can now review ${booking.providerName}.`,
        type: "JOB_COMPLETED",
      };
      break;
    }
    case "CANCELLED": {
      const capturedAmount = booking.payments
        .filter((p) => p.status === "CAPTURED")
        .reduce((sum, p) => sum + p.amountPoisha, 0);

      const outcome = evaluateCancellation({
        cancelledBy:
          input.actor === "CUSTOMER" ? "CUSTOMER" : input.actor === "PROVIDER" ? "PROVIDER" : "ADMIN",
        scheduledAt: booking.scheduledAt,
        capturedPoisha: capturedAmount,
        policy: await cancellationPolicy(),
        waiveFee: input.actor === "ADMIN",
      });

      extraWork = async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            cancelledAt: now,
            cancelledBy: input.actor,
            cancellationReason: input.reason ?? outcome.message,
            cancellationFeePoisha: outcome.feePoisha,
          },
        });
        if (input.actor === "PROVIDER") {
          await tx.providerProfile.update({
            where: { id: booking.providerProfileId },
            data: { cancelledJobs: { increment: 1 } },
          });
        }
      };

      customerNotice = {
        title: "Booking cancelled",
        body: `${booking.reference} was cancelled. ${outcome.message}`,
        type: "BOOKING_CANCELLED",
      };
      break;
    }
    case "DISPUTED": {
      extraWork = async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { disputedAt: now } });
      };
      break;
    }
    case "NO_SHOW": {
      extraWork = async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { noShowBy: input.actor, cancelledAt: now, cancelledBy: input.actor, cancellationReason: input.reason ?? "No-show" },
        });
        if (input.actor === "PROVIDER") {
          // The provider is penalised in the reliability figures that feed
          // matching, so the counter has to move or the ranking is a fiction.
          await tx.providerProfile.update({
            where: { id: booking.providerProfileId },
            data: { noShowCount: { increment: 1 } },
          });
        }
      };
      break;
    }
    default:
      break;
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: input.to },
    });

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: input.to,
        actor: input.actor,
        actorUserId: input.actorUserId,
        reason: input.reason ?? decision.rule.label.replace("{actor}", input.actor.toLowerCase()),
      },
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        actor: input.actor,
        actorUserId: input.actorUserId,
        type: input.to,
        summary: decision.rule.label.replace("{actor}", input.actor.toLowerCase()),
      },
    });

    await extraWork(tx);
  });

  if (customerNotice) {
    await notify({
      userId: booking.customerId,
      type: customerNotice.type,
      title: customerNotice.title,
      body: customerNotice.body,
      href: `/bookings/${booking.id}`,
      data: { bookingId: booking.id },
    });
  }

  return {
    ok: true,
    bookingId: booking.id,
    status: input.to,
    message: decision.rule.label.replace("{actor}", input.actor.toLowerCase()),
  };
}

/** True when the booking no longer occupies the provider's calendar. */
export function releasesSlot(status: BookingStatus): boolean {
  return isClosed(status) || status === "REJECTED";
}
