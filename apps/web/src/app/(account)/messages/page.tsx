import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser("/messages");

  const conversations = await prisma.conversation.findMany({
    where: { customerId: user.id },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      provider: { select: { displayName: true, slug: true } },
      booking: { select: { id: true, reference: true, serviceNameEn: true } },
    },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Messages</h1>

      {conversations.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No conversations yet. Booking a service starts a thread with that
          provider, which is usually the fastest way to sort out a problem.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {conversations.map((conversation, index) => (
            <li
              key={conversation.id}
              style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
            >
              <Link
                href={`/messages/${conversation.id}`}
                className="card interactive flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink-900">
                    {conversation.provider.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-600">
                    {conversation.lastMessagePreview ?? "No messages yet"}
                  </p>
                  {conversation.booking ? (
                    <p className="mt-1 text-xs text-ink-500">
                      {conversation.booking.serviceNameEn} ·{" "}
                      {conversation.booking.reference}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  {conversation.customerUnread > 0 ? (
                    <span className="animate-pop inline-block rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                      {conversation.customerUnread}
                    </span>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-400">
                    {new Date(conversation.lastMessageAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
