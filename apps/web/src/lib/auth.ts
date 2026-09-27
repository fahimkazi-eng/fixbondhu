import { redirect } from "next/navigation";
import { cache } from "react";

import {
  defaultSurfaceFor,
  hasEveryPermission,
  hasPermission,
  isStaffRole,
  type Permission,
  type Role,
  type Surface,
} from "@fixbondhu/core";

import { getCurrentUser } from "./session.js";
import type { SessionUser } from "./db.js";

/**
 * Authorisation.
 *
 * These guards are the only thing standing between a customer session and the
 * admin panel, so they run on the server on every request and never read a role
 * from a header, query parameter or client component. `cache()` dedupes the
 * user lookup across a single render pass, so calling a guard in a layout and
 * again in a page costs one query.
 */

export const getUser = cache(async (): Promise<SessionUser | null> => {
  return getCurrentUser();
});

/** Redirects to sign-in, remembering where the user was headed. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) {
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${target}`);
  }
  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    redirect("/account/suspended");
  }
  return user;
}

/**
 * Blocks non-staff and bounces a signed-in user to the surface they actually
 * belong to, so a support agent hitting an admin URL without the FINANCE role
 * gets a clear refusal rather than a blank page.
 */
export async function requireStaff(permission?: Permission): Promise<SessionUser> {
  const user = await requireUser();

  if (!user.roles.some((role) => isStaffRole(role))) {
    redirect("/");
  }
  if (permission && !hasPermission(user.roles, permission)) {
    redirect("/admin?denied=1");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.some((role) => user.roles.includes(role))) {
    redirect("/");
  }
  return user;
}

export async function requirePermission(...permissions: Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasEveryPermission(user.roles, permissions)) {
    redirect("/");
  }
  return user;
}

/**
 * A provider must have an approved profile before taking work. DRAFT and
 * PENDING_REVIEW providers can sign in and finish onboarding, but the moment
 * they could accept a job the platform would be committing to a customer on
 * their behalf.
 */
export async function requireActiveProvider(): Promise<
  SessionUser & { providerProfileId: string }
> {
  const user = await requireUser();

  if (!user.providerProfileId) {
    redirect("/pro/onboarding");
  }
  if (user.providerStatus !== "ACTIVE") {
    redirect("/pro/pending");
  }

  return user as SessionUser & { providerProfileId: string };
}

export function canAccess(user: SessionUser | null, permission: Permission): boolean {
  return user ? hasPermission(user.roles, permission) : false;
}

export function canUseSurface(user: SessionUser | null, surface: Surface): boolean {
  if (!user) return false;
  if (surface === "admin") return user.roles.some((role) => isStaffRole(role));
  if (surface === "provider") return user.roles.includes("PROVIDER");
  return user.roles.includes("CUSTOMER") || user.roles.length > 0;
}

export function homeFor(user: SessionUser): string {
  const surface = defaultSurfaceFor(user.roles);
  return surface === "admin" ? "/admin" : surface === "provider" ? "/pro" : "/";
}

/** True when the user is verified at the phone level, required to transact. */
export function canTransact(user: SessionUser | null): boolean {
  return Boolean(user?.phoneVerified);
}
