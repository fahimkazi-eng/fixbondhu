import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { createSession, requestContext } from "@/lib/session";
import { fieldErrors, loginSchema } from "@/lib/validation";
import {
  clearIpRateLimit,
  isAccountLocked,
  MAX_FAILED_LOGINS,
  rateLimitIp,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/rate-limit";
import { fail, handleApiError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign-in.
 *
 * The failure path is deliberately uniform. Whether the number is unknown or
 * the password is wrong, the client receives the same message and the response
 * takes a comparable amount of work, so the endpoint cannot be used to
 * enumerate which mobile numbers have accounts.
 */

const IP_LIMIT = 10;
const IP_WINDOW_MS = 10 * 60_000;

export async function POST(request: Request) {
  try {
    const { ip, userAgent } = await requestContext();

    const limit = rateLimitIp(`login:${ip ?? "unknown"}`, IP_LIMIT, IP_WINDOW_MS);
    if (!limit.allowed) {
      return fail(
        "RATE_LIMITED",
        "Too many sign-in attempts. Please try again shortly.",
        429,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION_FAILED", "Invalid request.", 422);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_FAILED", "Please check the form.", 422, fieldErrors(parsed.error));
    }

    const { phone, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        lockedUntil: true,
        failedLoginCount: true,
      },
    });

    /*
     * Uniform failure. When the account does not exist a dummy hash is
     * compared against so the timing is not obviously different from a real
     * password check, which would otherwise leak account existence.
     */
    const DUMMY_HASH = "$2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123";

    const passwordMatches = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : (await bcrypt.compare(password, DUMMY_HASH), false);

    if (!user || !passwordMatches) {
      if (user) {
        const lock = await isAccountLocked(user.id);
        if (!lock.locked) {
          await recordFailedLogin(user.id);
        }
      }
      return fail(
        "UNAUTHENTICATED",
        "The mobile number or password is incorrect.",
        401,
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      return fail(
        "RATE_LIMITED",
        `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        429,
      );
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return fail(
        "FORBIDDEN",
        "This account has been suspended. Contact support for help.",
        403,
      );
    }

    if (user.status === "DEACTIVATED") {
      return fail("FORBIDDEN", "This account is no longer active.", 403);
    }

    await recordSuccessfulLogin(user.id);
    clearIpRateLimit(`login:${ip ?? "unknown"}`);

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: "CUSTOMER",
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        summary: "Signed in",
        ip: ip ?? null,
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });

    await createSession({ userId: user.id, ip, userAgent });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error, "auth/login");
  }
}

export { MAX_FAILED_LOGINS };
