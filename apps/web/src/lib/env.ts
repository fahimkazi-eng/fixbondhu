import { z } from "zod";

/**
 * Environment, validated once at first use.
 *
 * Validating lazily rather than at module scope matters for two reasons: the
 * Next.js build evaluates modules without runtime env in some passes, and a
 * missing variable should produce one clear error naming the variable, not a
 * stack trace from deep inside a driver.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Pooled URL for runtime queries, direct URL for migrations.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // 32+ random bytes. A short secret silently weakens every session cookie.
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters"),

  APP_URL: z.string().url().default("http://localhost:3000"),

  // --- payments ------------------------------------------------------------
  PAYMENT_GATEWAY: z.enum(["sandbox", "bkash"]).default("sandbox"),
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .min(16, "PAYMENT_WEBHOOK_SECRET must be at least 16 characters")
    .default("sandbox-only-secret-do-not-use-in-production"),
  PAYMENT_CURRENCY: z.string().default("BDT"),

  // --- commission ----------------------------------------------------------
  DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(1200),

  // --- business rules, overridable from the admin panel --------------------
  FREE_CANCEL_HOURS: z.coerce.number().int().min(0).default(12),
  LATE_CANCEL_HOURS: z.coerce.number().int().min(0).default(2),
  LATE_CANCEL_FEE_POISHA: z.coerce.number().int().min(0).default(20_000),
  CUSTOMER_NO_SHOW_FEE_POISHA: z.coerce.number().int().min(0).default(30_000),
  PROVIDER_RESPONSE_MINUTES: z.coerce.number().int().min(5).default(30),

  // --- notifications (all optional, degrade to SKIPPED) --------------------
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("FixBondhu <no-notify@fixbondhu.com>"),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().default("FixBondhu"),

  // --- optional infrastructure --------------------------------------------
  REDIS_URL: z.string().optional(),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the missing values.`,
    );
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * bKash is only usable when real merchant credentials are present. The gateway
 * refuses to pretend otherwise, because a sandbox that silently accepts live
 * traffic is how a marketplace ends up with unpaid work and no record of it.
 */
export function hasBkashCredentials(): boolean {
  return Boolean(
    process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD,
  );
}
