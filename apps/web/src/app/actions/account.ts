"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeBdPhone } from "@fixbondhu/core";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export interface CompleteState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number.")
  .transform((value) => normalizeBdPhone(value))
  .refine((value): value is string => value !== null, "Enter a valid Bangladeshi number.");

/**
 * Adds a mobile number to an account created through Google.
 *
 * Google does not share a phone number, and a provider cannot be contacted
 * without one, so an account without it cannot book. This is the step that
 * closes that gap.
 *
 * Setting phoneVerifiedAt is deliberately NOT done here: the number was typed,
 * not proven. Anything relying on verification keeps returning false until a real
 * verification flow exists, and nothing claims otherwise.
 */
export async function completeProfile(
  _prev: CompleteState | null,
  formData: FormData,
): Promise<CompleteState> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Please sign in again." };
  }

  if (user.phone) {
    revalidatePath("/account");
    return { ok: true, message: "Your account is complete." };
  }

  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: { phone: parsed.error.issues[0]?.message ?? "Enter a valid number." },
    };
  }

  const taken = await prisma.user.findFirst({
    where: { phone: parsed.data, id: { not: user.id } },
    select: { id: true },
  });
  if (taken) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: { phone: "That number is already registered to another account." },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { phone: parsed.data },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: "CUSTOMER",
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      summary: "Added a mobile number to complete the profile",
    },
  });

  revalidatePath("/account");
  revalidatePath("/account/complete");
  return { ok: true, message: "Saved. You can now book services." };
}
