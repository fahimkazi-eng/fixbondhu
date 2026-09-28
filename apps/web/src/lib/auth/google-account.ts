/**
 * Turning a verified Google identity into a FixBondhu account.
 *
 * This is split out of the route handler on purpose. Proving that a forged token
 * is rejected is only half the security story; the other half is what happens to
 * the claims once they are genuine. That logic writes rows, links accounts and
 * issues sessions, so it needs to be reachable from a test without a real Google
 * token in hand.
 *
 * The split point is the ONLY boundary that matters: verifyGoogleIdToken is the
 * single way a GoogleIdentity is ever obtained, and resolveGoogleAccount accepts
 * nothing but an already-verified identity. Adding a caller that fabricates one
 * is the thing to watch for.
 *
 * It deliberately does NOT set a cookie. createSession needs Next's request
 * scope, which only a route handler or server action has, so issuing the session
 * is the caller's job once a signed-in outcome comes back. That keeps this
 * function pure database work and therefore testable outside a request, which is
 * the whole reason it exists as a separate module.
 */

import { generateReferralCode } from "@fixbondhu/core";

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import type { GoogleIdentity } from "@/lib/auth/google";

export type GoogleRefusal = { outcome: "suspended" | "deleted"; userId: string };
export type GoogleSignIn = {
  outcome: "signed-in" | "linked" | "created";
  userId: string;
  needsPhone: boolean;
};
export type GoogleResolution = GoogleSignIn | GoogleRefusal;

/**
 * Type guard, not just a boolean: the caller needs `needsPhone` to be reachable,
 * and the route reads it directly off the same value.
 */
export function shouldSignIn(resolution: GoogleResolution): resolution is GoogleSignIn {
  return (
    resolution.outcome === "signed-in"
    || resolution.outcome === "linked"
    || resolution.outcome === "created"
  );
}

/** Statuses that must never receive a session, whatever the credential proved. */
function blockedByStatus(status: string): "suspended" | null {
  return status === "SUSPENDED" || status === "BANNED" ? "suspended" : null;
}

/**
 * Resolves an already-verified Google identity to a signed-in user.
 *
 * Three cases, in order:
 *   1. the identity is already linked  -> sign in
 *   2. the email already has an account -> link and sign in, preserving history
 *   3. neither -> create an account
 *
 * Case 2 is the one that matters. Without it, a customer who registered with a
 * phone and later taps "Continue with Google" would be handed a brand new empty
 * account and would silently appear to have lost every booking, address and
 * message they had.
 */
export async function resolveGoogleAccount(
  identity: GoogleIdentity,
  ip: string | null,
): Promise<GoogleResolution> {
  // ---- 1. already linked --------------------------------------------------
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: identity.sub,
      },
    },
    include: { user: { select: { id: true, status: true, deletedAt: true, phone: true } } },
  });

  if (existingIdentity) {
    const { user } = existingIdentity;

    // A closed account stays closed. A valid Google token is proof of an email
    // address, not a reason to resurrect an account someone asked to delete.
    if (user.deletedAt) return { outcome: "deleted", userId: user.id };

    const blocked = blockedByStatus(user.status);
    if (blocked) return { outcome: blocked, userId: user.id };

    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: { lastUsedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: "CUSTOMER",
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        summary: "Signed in with Google",
        ip,
      },
    });

    return { outcome: "signed-in", userId: user.id, needsPhone: user.phone === null };
  }

  // ---- 2. email already registered: link, do not duplicate ---------------
  const byEmail = await prisma.user.findFirst({
    where: { email: identity.email, deletedAt: null },
    select: { id: true, status: true, phone: true },
  });

  if (byEmail) {
    const blocked = blockedByStatus(byEmail.status);
    if (blocked) return { outcome: blocked, userId: byEmail.id };

    // The unique constraint on (provider, providerAccountId) is the real
    // guarantee here; if two requests for the same new Google account race,
    // one of them loses on the insert rather than creating a second identity.
    await prisma.authIdentity.create({
      data: {
        userId: byEmail.id,
        provider: "google",
        providerAccountId: identity.sub,
        emailAtLink: identity.email,
      },
    });
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { lastLoginAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: byEmail.id,
        actorRole: "CUSTOMER",
        action: "LOGIN",
        entityType: "AuthIdentity",
        entityId: byEmail.id,
        summary: "Google account linked to existing account and signed in",
        ip,
      },
    });

    // No password is touched. The person proved they own the email through
    // Google, but the existing password keeps working exactly as before.
    return { outcome: "linked", userId: byEmail.id, needsPhone: byEmail.phone === null };
  }

  // ---- 3. new account ----------------------------------------------------
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: identity.name,
        email: identity.email,
        avatarUrl: identity.picture,
        // No password for this account. passwordHash stays null, so password
        // login simply cannot succeed for it rather than matching an empty hash.
        passwordHash: null,
        status: "ACTIVE",
        primaryRole: "CUSTOMER",
        roles: { create: { role: "CUSTOMER" } },
        identities: {
          create: {
            provider: "google",
            providerAccountId: identity.sub,
            emailAtLink: identity.email,
          },
        },
      },
      select: { id: true, phone: true },
    });

    await tx.customerProfile.create({
      data: { userId: created.id, referralCode: generateReferralCode() },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: created.id,
        actorRole: "CUSTOMER",
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        summary: "Account created with Google",
        ip,
      },
    });

    return created;
  });

  await notify({
    userId: user.id,
    type: "SYSTEM",
    title: "Welcome to FixBondhu",
    body: "Your account is ready. Add a mobile number so providers can reach you about a booking.",
    href: "/account",
  });

  // Google does not share a phone number, so a new account cannot book until
  // it has one. The client sends it to /account/complete.
  return { outcome: "created", userId: user.id, needsPhone: user.phone === null };
}
