import { NextResponse } from "next/server";
import { z } from "zod";

import { requestContext, createSession } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { rateLimitIp } from "@/lib/rate-limit";
import { isGoogleConfigured, verifyGoogleIdToken } from "@/lib/auth/google";
import { resolveGoogleAccount, shouldSignIn } from "@/lib/auth/google-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google sign-in.
 *
 * Deliberately thin. The two halves are separated so each can be tested on its
 * own terms:
 *
 *   verifyGoogleIdToken    proves the credential is genuine. Nothing it returns
 *                          is meaningful until the signature has been checked
 *                          against a key Google actually publishes.
 *   resolveGoogleAccount   decides which account that identity means. Reachable
 *                          from a test without a real Google token, which is how
 *                          the linking rules below are proven.
 *
 * The order matters and is not reversible: nothing reaches
 * resolveGoogleAccount until verification has succeeded.
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

    // Throws unless signature, algorithm, issuer, audience and email
    // verification all check out against Google's published keys.
    const identity = await verifyGoogleIdToken(parsed.data.credential, clientId);

    const resolution = await resolveGoogleAccount(identity, ip ?? null);

    // The session is issued here rather than inside the resolver, because
    // createSession needs Next's request scope. Resolution decides WHICH user;
    // only a handler can hand them a cookie.
    if (shouldSignIn(resolution)) {
      await createSession({ userId: resolution.userId, ip: ip ?? null });
    }

    switch (resolution.outcome) {
      case "suspended":
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "This account has been suspended. Contact support for help.",
            },
          },
          { status: 403 },
        );
      case "deleted":
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "This account has been closed. Contact support for help.",
            },
          },
          { status: 403 },
        );
      default:
        return ok({
          ok: true,
          outcome: resolution.outcome,
          needsPhone: resolution.needsPhone,
        });
    }
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
