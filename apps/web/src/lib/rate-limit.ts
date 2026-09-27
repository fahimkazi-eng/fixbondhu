/**
 * Login throttling.
 *
 * Two independent limits, because they defend against different attacks:
 *
 *  * Per-account, stored in Postgres. Survives a redeploy and a cold start, so
 *    a slow brute force cannot be reset by waiting for a new server instance.
 *    This is the limit that actually matters for guessing a password.
 *  * Per-IP, in process memory. Cheap, and blunts a spray across many
 *    accounts. In-memory is genuinely weak across serverless instances and the
 *    code says so rather than implying protection it does not provide; a real
 *    deployment should back this with Redis or the Neon Data API.
 */

import { prisma } from "./db";

/** Consecutive failures before the account is temporarily locked. */
export const MAX_FAILED_LOGINS = 8;
/** Lock duration. Long enough to make guessing impractical, short enough that a
 *  legitimate user who fat-fingers their password is not locked out for hours. */
export const LOCKOUT_MINUTES = 15;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Periodic sweep so the map cannot grow without bound on a long-lived process. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimitIp(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function clearIpRateLimit(key: string): void {
  buckets.delete(key);
}

/** Returns the lock expiry, or null when the account may attempt a sign-in. */
export async function isAccountLocked(
  userId: string,
): Promise<{ locked: boolean; until: Date | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true, status: true },
  });

  if (!user) return { locked: false, until: null };
  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    return { locked: true, until: null };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { locked: true, until: user.lockedUntil };
  }
  return { locked: false, until: null };
}

export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true },
  });
  if (!user) return;

  const nextCount = user.failedLoginCount + 1;
  await prisma.user.update({
    where: { id: userId },
    data: {
      // Clamped so a long campaign cannot leave an account locked for weeks
      // after a single success resets the counter.
      failedLoginCount: Math.min(nextCount, MAX_FAILED_LOGINS),
      lockedUntil:
        nextCount >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : null,
    },
  });
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}
