import { headers } from "next/headers";

import { CustomerShell } from "@/components/customer-shell";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Customer layout.
 *
 * Wraps the signed-in surfaces. The counts on the menu are live, so a badge only
 * appears when something is genuinely waiting.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  const [unread, messageUnread] = user
    ? await Promise.all([
        unreadCount(user.id),
        prisma.conversation.aggregate({
          where: { customerId: user.id, customerUnread: { gt: 0 } },
          _sum: { customerUnread: true },
        }),
      ])
    : [0, { _sum: { customerUnread: 0 } }];

  const h = await headers();
  const path = h.get("x-next-url") ?? h.get("x-invoke-path") ?? "/account";

  return (
    <CustomerShell
      unread={unread}
      messageUnread={messageUnread._sum.customerUnread ?? 0}
      path={path}
      signedInName={user?.name ?? null}
    >
      {children}
    </CustomerShell>
  );
}
