import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { createSession, requestContext } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { rateLimitIp } from "@/lib/rate-limit";
import { isGoogleConfigured, verifyGoogleIdToken } from "@/lib/auth/google";
import { generateReferralCode } from "@fixbondhu/core";
import { notify } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google sign-in.
 *
 * The interesting part is what happens when the email already exists. A person
 * who registered with a phone and password and later taps "Continue with
 * Google" must land in the SAME account, not a new empty one, or they silently
 * lose their bookings and history. So the link is by verified email.
 *
 * If that email already belongs to an account, the Google identity is attached
 * to it and the existing session is issued. No password is ever reset or
 * bypassed silently: the user proved ownership of the email through Google.
 */

const bodySchema = z.object({
  credential: z.string().min(20, "Missing Google credential."),
  /** True when the user clicked "sign up with Google" rather than "sign in". */
  intent: z.enum(["signin", "signup"]).default("signin"),
});

const IP_LIMIT = 10;
const IP_WINDOW_MS = 10 * 60_000;

export async function POST(request: Request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !isGoogleConfigured()) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_IMPLEMENTED",
            message: "Google sign-in is not configured on this deployment.",
          },
        },
        { status: 501 },
      );
    }

    const { ip } = await requestContext();

    const limit = rateLimitIp(`google:${ip ?? "unknown"}`, IP_LIMIT, IP_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again shortly." } },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid request." } },
        { status: 422 },
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Google sign-in failed to complete. Please try again.",
          },
        },
        { status: 422 },
      );
    }

    // Throws unless the signature, issuer, audience and email verification all
    // check out against Google's published keys.
    const identity = await verifyGoogleIdToken(parsed.data.credential, clientId);

    // 1. Already linked? Sign in.
    const existingIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: identity.sub,
        },
      },
      include: { user: { select: { id: true, status: true, deletedAt: true } } },
    });

    if (existingIdentity) {
      if (existingIdentity.user.deletedAt) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "This account has been closed. Contact support for help.",
            },
          },
          { status: 403 },
        );
      }
      if (existingIdentity.user.status === "SUSPENDED" || existingIdentity.user.status === "BANNED") {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "This account has been suspended. Contact support for help.",
            },
          },
          { status: 403 },
        );
      }

      await prisma.authIdentity.update({
        where: { id: existingIdentity.id },
        data: { lastUsedAt: new Date() },
      });
      await prisma.user.update({
        where: { id: existingIdentity.user.id },
        data: { lastLoginAt: new Date() },
      });
      await prisma.auditLog.create({
        data: {
          actorUserId: existingIdentity.user.id,
          actorRole: "CUSTOMER",
          action: "LOGIN",
          entityType: "User",
          entityId: existingIdentity.user.id,
          summary: "Signed in with Google",
          ip: ip ?? null,
        },
      });

      await createSession({ userId: existingIdentity.user.id, ip });
      return ok({ ok: true, existing: true });
    }

    // 2. Email already registered? Link the identity to that account.
    //    Without this a returning customer would get a fresh, empty account and
    //    lose their bookings, addresses and history.
    const byEmail = await prisma.user.findFirst({
      where: { email: identity.email, deletedAt: null },
      select: { id: true, status: true, customerProfile: { select: { id: true } } },
    });

    if (byEmail) {
      if (byEmail.status === "SUSPENDED" || byEmail.status === "BANNED") {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "This account has been suspended." } },
          { status: 403 },
        );
      }

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
          ip: ip ?? null,
        },
      });

      await createSession({ userId: byEmail.id, ip });
      return ok({ ok: true, linked: true });
    }

    // 3. New account.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: identity.name,
          email: identity.email,
          avatarUrl: identity.picture,
          // No password: this account signs in through Google. passwordHash
          // stays null, so password login simply will not work for it rather
          // than matching an empty hash.
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
        data: {
          userId: created.id,
          referralCode: generateReferralCode(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: created.id,
          actorRole: "CUSTOMER",
          action: "CREATE",
          entityType: "User",
          entityId: created.id,
          summary: "Account created with Google",
          ip: ip ?? null,
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

    await createSession({ userId: user.id, ip });

    // Google does not share a phone number, so a new account is sent to add
    // one. Providers cannot be contacted without it, and a booking cannot be
    // made until it exists.
    return ok({ ok: true, created: true, needsPhone: user.phone === null });
  } catch (error) {
    // A rejected Google token is the user's problem to fix by retrying, not a
    // server fault, so it is reported as a 401 with the reason kept in the log.
    if (error instanceof Error && error.name === "GoogleVerificationError") {
      console.warn("[google] token rejected:", error.message);
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Google sign-in could not be verified. Please try again.",
          },
        },
        { status: 401 },
      );
    }
    return handleApiError(error, "auth/google");
  }
}
