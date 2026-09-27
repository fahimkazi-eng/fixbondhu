import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChatThread } from "@/components/chat-thread";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/messages/${id}`);

  // Scoped to this customer, so guessing an id cannot read someone else's thread.
  const conversation = await prisma.conversation.findFirst({
    where: { id, customerId: user.id },
    include: {
      provider: { select: { displayName: true, slug: true } },
      booking: { select: { id: true, reference: true, serviceNameEn: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });

  if (!conversation) notFound();

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { customerUnread: 0 },
  });

  return (
    <div className="max-w-2xl">
      <Link href="/messages" className="text-sm text-ink-600 hover:text-ink-900">
        ← All messages
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">
            {conversation.provider.displayName}
          </h1>
          <Link
            href={`/providers/${conversation.provider.slug}`}
            className="text-xs text-brand-700 underline"
          >
            View profile
          </Link>
        </div>
        {conversation.booking ? (
          <Link href={`/bookings/${conversation.booking.id}`} className="chip">
            {conversation.booking.serviceNameEn} · {conversation.booking.reference}
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <ChatThread
          conversationId={conversation.id}
          peerName={conversation.provider.displayName}
          asProvider={false}
          messages={conversation.messages.map((message) => ({
            id: message.id,
            body: message.body,
            mine: message.senderUserId === user.id,
            createdAt: message.createdAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))}
        />
      </div>
    </div>
  );
}
