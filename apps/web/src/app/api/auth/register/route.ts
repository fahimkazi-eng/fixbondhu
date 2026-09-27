import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { generateReferralCode } from "@fixbondhu/core";

import { prisma } from "@/lib/db";
import { createSession, requestContext } from "@/lib/session";
import { fieldErrors, registerSchema } from "@/lib/validation";
import { rateLimitIp } from "@/lib/rate-limit";
import { fail, handleApiError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Account creation.
 *
 * Creates a customer and their profile in one transaction, so a user can never
 * exist without the profile the rest of the app assumes. No verification step:
 * the account is usable immediately, and phone verification is deliberately
 * deferred rather than faked.
 */

const BCRYPT_ROUNDS = 12;
const IP_LIMIT = 5;
const IP_WINDOW_MS = 10 * 60_000;

export async function POST(request: Request) {
  try {
    const { ip } = await requestContext();

    const limit = rateLimitIp(`register:${ip ?? "unknown"}`, IP_LIMIT, IP_WINDOW_MS);
    if (!limit.allowed) {
      return fail(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
        429,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION_FAILED", "Invalid request.", 422);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        "VALIDATION_FAILED",
        "Please check the form.",
        422,
        fieldErrors(parsed.error),
      );
    }

    const { name, phone, password } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      return fail("CONFLICT", "That mobile number is already registered.", 409);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          phone,
          // No phoneVerifiedAt: this account has not been verified, and nothing
          // in the product may imply that it has.
          passwordHash,
          status: "ACTIVE",
          primaryRole: "CUSTOMER",
          roles: { create: { role: "CUSTOMER" } },
        },
        select: { id: true },
      });

      await tx.customerProfile.create({
        data: {
          userId: created.id,
          // A referral code is issued to everyone, even with the programme
          // switched off, so enabling referrals later does not require a
          // backfill and no code needs to be shown until it is real.
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
          summary: "Account created",
          ip: ip ?? null,
        },
      });

      return created;
    });

    await createSession({ userId: user.id, ip });

    return ok({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "auth/register");
  }
}
