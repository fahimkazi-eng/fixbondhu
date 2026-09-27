import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { env, isProduction } from "./env.js";
import { loadUserById, type SessionUser } from "./db.js";

/**
 * Stateless session token.
 *
 * The token carries only the user id and a session id. It deliberately does NOT
 * carry roles: roles are loaded from the database on each request so revoking
 * access takes effect immediately instead of when the cookie happens to
 * expire. The Session row additionally allows forced sign-out of a stolen
 * cookie, which a pure JWT cannot do.
 */

const COOKIE_NAME = "fb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let cachedKey: Uint8Array | null = null;

function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  cachedKey = new TextEncoder().encode(env().AUTH_SECRET);
  return cachedKey;
}

export async function signSessionToken(input: {
  userId: string;
  sessionId: string;
}): Promise<string> {
  return new SignJWT({ sid: input.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setIssuer("fixbondhu")
    .setAudience("fixbondhu-web")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<{
  userId: string;
  sessionId: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "fixbondhu",
      audience: "fixbondhu-web",
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export async function createSession(input: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { prisma } = await import("./db.js");
  // The raw token is never stored. Hashing it means a database leak does not
  // hand an attacker usable sessions.
  const { createHash, randomUUID } = await import("node:crypto");

  const sessionId = randomUUID();
  const token = await signSessionToken({ userId: input.userId, sessionId });
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: input.userId,
      tokenHash,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      const { prisma } = await import("./db.js");
      await prisma.session
        .update({
          where: { id: verified.sessionId },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
    }
  }

  store.delete(COOKIE_NAME);
}

/**
 * Resolves the current user, or null. A revoked or expired Session row ends the
 * session even though the JWT itself is still cryptographically valid.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const verified = await verifySessionToken(token);
  if (!verified) return null;

  const { prisma } = await import("./db.js");
  const session = await prisma.session.findUnique({
    where: { id: verified.sessionId },
    select: { revokedAt: true, expiresAt: true, userId: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.userId !== verified.userId) {
    return null;
  }

  return loadUserById(verified.userId);
}

/** Request metadata for audit rows. Never trust client-supplied headers. */
export async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}
