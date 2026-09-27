/**
 * Notifications.
 *
 * Writing a notification and delivering it are separate concerns. The row is
 * written synchronously so the in-app inbox is never missing an event, and
 * delivery to SMS, email and push is recorded as separate attempts.
 *
 * A channel with no credentials is recorded as SKIPPED, never silently dropped.
 * That distinction matters operationally: "we sent nothing because nobody
 * configured the provider" and "we sent nothing and do not know why" look
 * identical to a customer whose provider never turned up.
 */

import { Enums } from "@fixbondhu/db";

import { prisma } from "@/lib/db";

/**
 * The event type is the database enum, not a hand-written union. An earlier
 * version listed the variants by hand and silently drifted, so a new event
 * could be added to the schema and then fail to compile at the call site.
 */
export type NotifyType = Enums.NotificationType;

export interface NotifyInput {
  userId: string;
  type: NotifyType;
  title: string;
  body: string;
  href?: string | null;
  data?: Record<string, unknown>;
}

/** Which channels to attempt for an event. */
const CHANNELS = ["IN_APP", "SMS", "EMAIL"] as const;

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        phone: true,
        email: true,
        notificationPreferences: {
          select: { channel: true, event: true, enabled: true },
        },
      },
    });
    if (!user) return;

    // Honour an explicit opt-out. Absence of a preference row means default on.
    const suppressed = new Set(
      user.notificationPreferences
        .filter((p) => !p.enabled && p.event === input.type)
        .map((p) => p.channel),
    );

    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        data: (input.data ?? {}) as never,
      },
      select: { id: true },
    });

    for (const channel of CHANNELS) {
      if (suppressed.has(channel)) {
        await prisma.notificationDelivery.create({
          data: { notificationId: notification.id, channel, status: "SKIPPED", error: "user preference" },
        });
        continue;
      }

      // A channel with no integration configured is recorded as SKIPPED rather
      // than reported as sent.
      const configured =
        channel === "IN_APP" ||
        (channel === "EMAIL" && Boolean(process.env.RESEND_API_KEY) && Boolean(user.email)) ||
        (channel === "SMS" && Boolean(process.env.SMS_API_KEY) && Boolean(user.phone));

      await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel,
          status: configured ? "PENDING" : "SKIPPED",
          error: configured ? null : "channel not configured",
        },
      });
    }
  } catch (error) {
    /*
     * A failed notification must never fail the business operation that
     * triggered it. The booking is real whether or not the SMS went out, and
     * losing the booking to protect a text message is the wrong trade.
     */
    console.error("[notify] failed:", error);
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  // Scoped by userId so one account cannot mark another's notification read.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
