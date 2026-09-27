import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChatThread } from "@/components/chat-thread";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProviderMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/messages");

  // Scoped to this provider, so another provider guessing the id gets a 404
  // rather than reading a customer's messages.
  const conversation = await prisma.conversation.findFirst({
    where: { id, providerProfileId: user.providerProfileId },
    include: {
      customer: { select: { name: true } },
      booking: { select: { id: true, reference: true, serviceNameEn: true, status: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });

  if (!conversation) notFound();

  // Opening a thread marks it read. Scoped to this conversation so it cannot
  // clear someone else's unread count.
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { providerUnread: 0 },
  });

  return (
    <div className="max-w-3xl">
      <Link href="/pro/messages" className="text-sm text-ink-600 hover:text-ink-900">
        ← All messages
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">
          {conversation.customer.name}
        </h1>
        {conversation.booking ? (
          <Link href={`/pro/bookings/${conversation.booking.id}`} className="chip">
            {conversation.booking.serviceNameEn} · {conversation.booking.reference}
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <ChatThread
          conversationId={conversation.id}
          peerName={conversation.customer.name}
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
