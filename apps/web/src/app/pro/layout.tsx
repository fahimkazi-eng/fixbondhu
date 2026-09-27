import Link from "next/link";
import { headers } from "next/headers";

import { ProviderShell } from "@/components/provider-shell";
import { getUser } from "@/lib/auth";
import { providerNav } from "@/lib/provider-nav";

export const dynamic = "force-dynamic";

/**
 * Provider layout.
 *
 * This is chrome only. The menu is built from live counts, and the real
 * authorisation happens per page and per server action. A rewrite onto this
 * route group grants nothing: a customer can type /pro/jobs directly and each
 * page resolves the provider profile from the session or redirects.
 */
export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const profileId = user?.providerProfileId ?? null;

  // Without a provider profile there is nothing to count, so the menu renders
  // with zeroed counts and the page itself handles onboarding.
  const { groups, unread } = profileId
    ? await providerNav(profileId)
    : { groups: [] as Awaited<ReturnType<typeof providerNav>>["groups"], unread: 0 };

  const h = await headers();
  const current = h.get("x-next-url") ?? h.get("x-invoke-path") ?? "/pro";

  return (
    <ProviderShell groups={groups} current={current} unreadCount={unread}>
      {children}
    </ProviderShell>
  );
}
