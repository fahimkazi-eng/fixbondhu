import { z } from "zod";

import { normalizeBdPhone } from "@fixbondhu/core";

/**
 * Input validation for account creation and sign-in.
 *
 * Validation lives here rather than in route handlers so the rules are stated
 * once and both the client and the server enforce the same shape. The server
 * copy is the one that matters: the client copy exists only to give fast
 * feedback, never to decide what is acceptable.
 */

const BD_PHONE_MESSAGE = "Enter a valid Bangladeshi mobile number, for example 01712 345678.";

const rawPhone = z
  .string()
  .trim()
  .min(1, "Mobile number is required.")
  .refine((value) => normalizeBdPhone(value) !== null, BD_PHONE_MESSAGE);

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required.")
  .transform((value) => normalizeBdPhone(value))
  .refine((value): value is string => value !== null, BD_PHONE_MESSAGE);

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your full name.")
  .max(80, "Name must be 80 characters or fewer.");

/*
 * bcrypt silently truncates at 72 bytes. A 73-character password would appear
 * to work while the tail was ignored, which is a real security weakness rather
 * than a cosmetic limit, so the ceiling is enforced at the boundary. The byte
 * check matters because Bangla names and passwords are multi-byte.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 bytes or fewer.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be 72 bytes or fewer.",
  );

export const registerSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    phone: phoneSchema,
    password: z.string().min(1, "Enter your password."),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Flattens a Zod error into { field: message } for form display. */
export function fieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    // Keep the first message per field; later ones are usually downstream.
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
