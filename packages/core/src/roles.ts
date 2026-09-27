/**
 * Roles and permissions.
 *
 * Authorisation is resolved from the roles stored on the user, never from
 * anything the client sends. The three deployment domains (customer, provider,
 * admin) are separate surfaces over one API, so each carries its own role
 * requirement — a SUPPORT agent holding a session cookie cannot simply call
 * customer endpoints and impersonate a booking, because the guard compares the
 * session domain against the route's required domain as well as the role set.
 */

export const ROLES = [
  "CUSTOMER",
  "PROVIDER",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "VERIFICATION",
  "CONTENT",
  "ANALYST",
] as const;

export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = [
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "VERIFICATION",
  "CONTENT",
  "ANALYST",
] as const satisfies readonly Role[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: Role): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export type Permission =
  // customer
  | "booking:create"
  | "booking:read:own"
  | "booking:cancel:own"
  | "booking:review:own"
  | "address:manage:own"
  | "message:send:customer"
  | "coupon:redeem"
  | "complaint:create:own"
  | "ticket:create:own"
  // provider
  | "provider:profile:manage"
  | "provider:service:manage"
  | "provider:area:manage"
  | "provider:availability:manage"
  | "booking:accept"
  | "booking:progress"
  | "booking:complete"
  | "booking:charge:request"
  | "booking:read:assigned"
  | "message:send:provider"
  | "payout:read:own"
  | "portfolio:manage"
  | "complaint:respond:own"
  // verification
  | "verification:submit"
  // staff - support
  | "admin:access"
  | "booking:manage"
  | "complaint:manage"
  | "dispute:manage"
  | "ticket:manage"
  | "user:read"
  | "review:moderate"
  // staff - verification
  | "provider:verify"
  | "provider:suspend"
  // staff - finance
  | "payment:read"
  | "refund:issue"
  | "payout:manage"
  | "commission:manage"
  // staff - content
  | "category:manage"
  | "service:manage"
  | "coupon:manage"
  | "promotion:manage"
  | "referral:manage"
  | "content:manage"
  // staff - analyst
  | "analytics:read"
  | "report:export"
  // staff - admin only
  | "settings:manage"
  | "audit:read"
  | "role:manage"
  | "payout:approve";

const CUSTOMER_PERMISSIONS: readonly Permission[] = [
  "booking:create",
  "booking:read:own",
  "booking:cancel:own",
  "booking:review:own",
  "address:manage:own",
  "message:send:customer",
  "coupon:redeem",
  "complaint:create:own",
  "ticket:create:own",
];

const PROVIDER_PERMISSIONS: readonly Permission[] = [
  "provider:profile:manage",
  "provider:service:manage",
  "provider:area:manage",
  "provider:availability:manage",
  "booking:accept",
  "booking:progress",
  "booking:complete",
  "booking:charge:request",
  "booking:read:assigned",
  "message:send:provider",
  "payout:read:own",
  "portfolio:manage",
  "complaint:respond:own",
  "verification:submit",
];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: CUSTOMER_PERMISSIONS,
  PROVIDER: PROVIDER_PERMISSIONS,
  SUPPORT: [
    ...CUSTOMER_PERMISSIONS,
    "admin:access",
    "booking:manage",
    "complaint:manage",
    "dispute:manage",
    "ticket:manage",
    "user:read",
    "review:moderate",
  ],
  VERIFICATION: [
    ...CUSTOMER_PERMISSIONS,
    "admin:access",
    "provider:verify",
    "provider:suspend",
    "user:read",
  ],
  FINANCE: [
    ...CUSTOMER_PERMISSIONS,
    "admin:access",
    "payment:read",
    "refund:issue",
    "payout:manage",
    "payout:approve",
    "commission:manage",
    "user:read",
    "analytics:read",
  ],
  CONTENT: [
    ...CUSTOMER_PERMISSIONS,
    "admin:access",
    "category:manage",
    "service:manage",
    "coupon:manage",
    "promotion:manage",
    "referral:manage",
    "content:manage",
  ],
  ANALYST: [
    ...CUSTOMER_PERMISSIONS,
    "admin:access",
    "analytics:read",
    "report:export",
  ],
  // ADMIN is a superset. It is granted explicitly rather than by union so that
  // revoking ADMIN removes every privilege in one step.
  ADMIN: [
    ...CUSTOMER_PERMISSIONS,
    ...PROVIDER_PERMISSIONS,
    "admin:access",
    "booking:manage",
    "complaint:manage",
    "dispute:manage",
    "ticket:manage",
    "user:read",
    "review:moderate",
    "provider:verify",
    "provider:suspend",
    "payment:read",
    "refund:issue",
    "payout:manage",
    "payout:approve",
    "commission:manage",
    "category:manage",
    "service:manage",
    "coupon:manage",
    "promotion:manage",
    "referral:manage",
    "content:manage",
    "analytics:read",
    "report:export",
    "settings:manage",
    "audit:read",
    "role:manage",
  ],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      granted.add(permission);
    }
  }
  return granted;
}

export function hasPermission(
  roles: readonly Role[],
  permission: Permission,
): boolean {
  return permissionsFor(roles).has(permission);
}

export function hasEveryPermission(
  roles: readonly Role[],
  permissions: readonly Permission[],
): boolean {
  const granted = permissionsFor(roles);
  return permissions.every((permission) => granted.has(permission));
}

export function hasAnyPermission(
  roles: readonly Role[],
  permissions: readonly Permission[],
): boolean {
  const granted = permissionsFor(roles);
  return permissions.some((permission) => granted.has(permission));
}

/** Which of the three platforms a role set is allowed to open. */
export type Surface = "customer" | "provider" | "admin";

export function canAccessSurface(roles: readonly Role[], surface: Surface): boolean {
  switch (surface) {
    case "customer":
      return roles.includes("CUSTOMER");
    case "provider":
      return roles.includes("PROVIDER");
    case "admin":
      return roles.some((role) => isStaffRole(role));
  }
}

/**
 * The surface a user should be sent to after login. Staff land in admin; a
 * person who is both a customer and a provider lands on the customer site,
 * which is the lower-risk default, and can navigate to the provider site
 * explicitly.
 */
export function defaultSurfaceFor(roles: readonly Role[]): Surface {
  if (roles.some((role) => isStaffRole(role))) return "admin";
  if (roles.includes("PROVIDER")) return "provider";
  return "customer";
}
