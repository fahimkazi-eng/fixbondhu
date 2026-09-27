/**
 * Settings.
 *
 * Commercial terms live in the database so finance and support can change them
 * without a deploy. Reads are cached for a short window because settings are
 * consulted on hot paths like booking creation, and a stale fee for a few
 * seconds is acceptable while a stale one forever would not be.
 */

import { prisma } from "@/lib/db";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    const value = (row?.value ?? fallback) as T;
    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch {
    // Settings must never take a booking down. A database blip falls back to
    // the compiled default rather than failing the customer's request.
    return fallback;
  }
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const value = await getSetting<unknown>(key, fallback);
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export async function getSettingBoolean(key: string, fallback: boolean): Promise<boolean> {
  const value = await getSetting<unknown>(key, fallback);
  return typeof value === "boolean" ? value : fallback;
}

export async function setSetting(key: string, value: unknown, updatedByUserId: string | null) {
  const result = await prisma.setting.upsert({
    where: { key },
    update: { value: value as never, updatedByUserId },
    create: { key, value: value as never, updatedByUserId, group: "general" },
  });
  cache.delete(key);
  return result;
}

/** Called after an admin changes settings so the next read is immediate. */
export function invalidateSettings(): void {
  cache.clear();
}
