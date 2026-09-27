"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/session";
import { markAllRead } from "@/lib/notifications";

/**
 * Notification actions.
 *
 * The user is taken from the session, never from the form, so this cannot mark
 * anyone else's notifications read.
 */
export async function markAllReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/account");
}
