import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markRead } from "@/lib/notifications";
import { MarkNotificationsRead } from "@/components/mark-notifications-read";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Notification inbox.
 *
 * Notifications are only ever written as a consequence of a real event, so this
 * list is a record of what actually happened rather than engagement theatre.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser("/notifications");
  const { id } = await searchParams;

  if (id) {
    // Scoped by userId so a crafted id cannot mark someone else's as read.
    await markRead(user.id, id);
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">
          Notifications
          {unread > 0 ? (
            <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-50">
              {unread}
            </span>
          ) : null}
        </h1>
        {unread > 0 ? <MarkNotificationsRead /> : null}
      </div>

      {notifications.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          Nothing yet. You are notified when a provider responds to a request, when
          they are on their way, and when a job is complete.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-1.5">
          {notifications.map((notification, index) => {
            const body = (
              <>
                <div className="flex items-start gap-2">
                  {!notification.readAt ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"
                      aria-label="Unread"
                    />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        notification.readAt ? "text-ink-700" : "font-medium text-ink-900"
                      }`}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-600">{notification.body}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {new Date(notification.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </>
            );

            return (
              <li
                key={notification.id}
                className="card animate-slide-in"
                style={{ "--i": Math.min(index, 10) } as React.CSSProperties}
              >
                {notification.href ? (
                  <Link href={notification.href} className="block p-3.5">
                    {body}
                  </Link>
                ) : (
                  <div className="p-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
