import { loadRootEnv } from "./load-root-env.js";

// Must run before the Prisma client is constructed, because the Neon adapter
// reads DATABASE_URL at construction time.
loadRootEnv();

/**
 * Server-only by construction, not by marker.
 *
 * The `server-only` package is deliberately avoided here because it throws
 * outside a React Server Component, which would stop the verification scripts
 * from importing this module. The protection it provided is preserved in
 * practice: every function in this file is async and reaches the database, and
 * a Client Component that imported it would fail to bundle and to run.
 *
 * Never import this from a file with "use client".
 */
import { prisma } from "@fixbondhu/db";
import type { Role, UserStatus } from "@fixbondhu/core";

export { prisma };

/**
 * The identity attached to a request.
 *
 * Roles are read from the database on every request rather than trusted from
 * the cookie. A JWT stays valid until it expires, so a role baked into it would
 * keep granting staff access after an admin revoked it. The cost is one indexed
 * primary-key read per request, which is a fair price for permissions that
 * actually change.
 */
export interface SessionUser {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  primaryRole: Role;
  roles: Role[];
  phoneVerified: boolean;
  /** Null when the user has never opened a provider profile. */
  providerProfileId: string | null;
  providerStatus: string | null;
  /** Null when the user has never been a customer. */
  customerProfileId: string | null;
}

export async function loadUserById(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      avatarUrl: true,
      status: true,
      primaryRole: true,
      phoneVerifiedAt: true,
      roles: { select: { role: true } },
      customerProfile: { select: { id: true } },
      providerProfile: { select: { id: true, status: true } },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    status: user.status,
    primaryRole: user.primaryRole,
    // The CUSTOMER/PROVIDER roles are implied by owning a profile rather than
    // by a role row, so onboarding as a provider does not require a second
    // write and cannot be half-applied.
    roles: [
      ...new Set<Role>([
        ...user.roles.map((assignment) => assignment.role),
        ...(user.customerProfile ? (["CUSTOMER"] as const) : []),
        ...(user.providerProfile ? (["PROVIDER"] as const) : []),
      ]),
    ],
    phoneVerified: user.phoneVerifiedAt !== null,
    providerProfileId: user.providerProfile?.id ?? null,
    providerStatus: user.providerProfile?.status ?? null,
    customerProfileId: user.customerProfile?.id ?? null,
  };
}
