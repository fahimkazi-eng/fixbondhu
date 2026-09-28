import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProviderMessagesPage() {
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/services");

  const conversations = await prisma.conversation.findMany({
    where: { providerProfileId: user.providerProfileId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Messages</h1>

      {conversations.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No conversations yet. A thread starts when a customer messages you about a
          booking.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {conversations.map((conversation) => (
            <li key={conversation.id} style={{ "--i": Math.min(conversations.indexOf(conversation), 8) } as React.CSSProperties}>
              <Link
                href={`/pro/messages/${conversation.id}`}
                className="card interactive flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink-900">
                    {conversation.customer.name}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-600">
                    {conversation.lastMessagePreview ?? "No messages yet"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {conversation.providerUnread > 0 ? (
                    <span className="animate-pop inline-block rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-50">
                      {conversation.providerUnread}
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
