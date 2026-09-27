import { prisma } from "@/lib/db";
import { destroySession, requestContext } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign-out.
 *
 * Revokes the server-side Session row rather than only clearing the cookie.
 * A JWT stays cryptographically valid until it expires, so clearing the cookie
 * alone would leave a stolen token usable for the rest of its 30-day life.
 */
export async function POST() {
  try {
    const { ip } = await requestContext();
    const userId = await currentUserId();

    await destroySession();

    if (userId) {
      await prisma.auditLog
        .create({
          data: {
            actorUserId: userId,
            action: "LOGOUT",
            entityType: "User",
            entityId: userId,
            summary: "Signed out",
            ip: ip ?? null,
          },
        })
        .catch(() => undefined);
    }

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error, "auth/logout");
  }
}

async function currentUserId(): Promise<string | null> {
  const { getCurrentUser } = await import("@/lib/session");
  const user = await getCurrentUser();
  return user?.id ?? null;
}
