import type { SessionUser } from "@/lib/types";

/**
 * Role hierarchy (highest → lowest):
 *   OWNER > ADMIN > MANAGER > EMPLOYEE
 *
 * Permission philosophy:
 * - OWNER:    Full access to everything. Only role that can change other users' roles.
 * - ADMIN:    Same as OWNER except cannot change roles or remove other ADMINs.
 * - MANAGER:  Can manage shifts, employees, locations, approve/reject requests.
 *             Cannot access workspace settings, automations, invitations, payroll export.
 * - EMPLOYEE: Read-only on most resources. Can manage own availability, absences,
 *             time entries, and REQUEST shift changes (not directly edit shifts).
 */

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";

/** Roles that can manage resources (create/edit/delete shifts, employees, locations). */
const MANAGEMENT_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER"];

/** Roles that have full administrative access (settings, invitations, payroll). */
const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"];

// ─── Role Check Helpers ────────────────────────────────────────

/**
 * Check if the user has one of the specified roles.
 */
export function hasRole(user: SessionUser, roles: Role[]): boolean {
  return roles.includes(user.role as Role);
}

/**
 * Check if the user is OWNER, ADMIN, or MANAGER — i.e. can manage resources.
 */
export function isManagement(user: SessionUser): boolean {
  return hasRole(user, MANAGEMENT_ROLES);
}

/**
 * Check if the user is OWNER or ADMIN — i.e. has full admin access.
 */
export function isAdmin(user: SessionUser): boolean {
  return hasRole(user, ADMIN_ROLES);
}

/**
 * Check if the user is the OWNER.
 */
export function isOwner(user: SessionUser): boolean {
  return user.role === "OWNER";
}

/**
 * Check if the user is an EMPLOYEE (lowest permission level).
 */
export function isEmployee(user: SessionUser): boolean {
  return user.role === "EMPLOYEE";
}

// ─── Permission Matrix ────────────────────────────────────────

export type Resource =
  | "shifts"
  | "employees"
  | "locations"
  | "absences"
  | "availability"
  | "time-entries"
  | "shift-change-requests"
  | "shift-swap-requests"
  | "invitations"
  | "team"
  | "automations"
  | "payroll-export"
  | "time-accounts"
  | "notifications"
  | "settings";

export type Action = "read" | "create" | "update" | "delete" | "approve";

/**
 * Full permission matrix. Returns true if the given role is allowed
 * to perform the action on the resource.
 *
 * Note: Some actions have additional ownership-level checks
 * (e.g. EMPLOYEE can only read/create their OWN resources).
 * Those are enforced at the route level, not here.
 */
const permissionMatrix: Record<Resource, Record<Action, Role[]>> = {
  shifts: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE filtered to own
    create: ["OWNER", "ADMIN", "MANAGER"],
    update: ["OWNER", "ADMIN", "MANAGER"],
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: [], // N/A
  },
  employees: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE sees limited data
    create: ["OWNER", "ADMIN", "MANAGER"],
    update: ["OWNER", "ADMIN", "MANAGER"],
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: [],
  },
  locations: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
    create: ["OWNER", "ADMIN", "MANAGER"],
    update: ["OWNER", "ADMIN", "MANAGER"],
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: [],
  },
  absences: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE filtered to own
    create: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE can submit requests
    update: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE can cancel own
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: ["OWNER", "ADMIN", "MANAGER"],
  },
  availability: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE sees own
    create: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE manages own
    update: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: [],
  },
  "time-entries": {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE filtered to own
    create: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE creates own
    update: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE edits own drafts
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: ["OWNER", "ADMIN", "MANAGER"],
  },
  "shift-change-requests": {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE sees own
    create: ["EMPLOYEE"], // Only employees request changes
    update: ["EMPLOYEE"], // EMPLOYEE can cancel own pending request
    delete: [],
    approve: ["OWNER", "ADMIN", "MANAGER"],
  },
  "shift-swap-requests": {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
    create: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
    update: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
    delete: ["OWNER", "ADMIN", "MANAGER"],
    approve: ["OWNER", "ADMIN", "MANAGER"],
  },
  invitations: {
    read: ["OWNER", "ADMIN"],
    create: ["OWNER", "ADMIN"],
    update: ["OWNER", "ADMIN"],
    delete: ["OWNER", "ADMIN"],
    approve: [],
  },
  team: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"],
    create: [],
    update: ["OWNER"], // Only OWNER can change roles
    delete: ["OWNER", "ADMIN"],
    approve: [],
  },
  automations: {
    read: ["OWNER", "ADMIN"],
    create: ["OWNER", "ADMIN"],
    update: ["OWNER", "ADMIN"],
    delete: ["OWNER", "ADMIN"],
    approve: [],
  },
  "payroll-export": {
    read: ["OWNER", "ADMIN"],
    create: ["OWNER", "ADMIN"],
    update: [],
    delete: [],
    approve: [],
  },
  "time-accounts": {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // EMPLOYEE sees own
    create: ["OWNER", "ADMIN", "MANAGER"],
    update: ["OWNER", "ADMIN", "MANAGER"],
    delete: ["OWNER", "ADMIN"],
    approve: [],
  },
  notifications: {
    read: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // Own notifications
    create: [],
    update: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"], // Mark own as read
    delete: [],
    approve: [],
  },
  settings: {
    read: ["OWNER", "ADMIN"],
    create: ["OWNER", "ADMIN"],
    update: ["OWNER", "ADMIN"],
    delete: ["OWNER", "ADMIN"],
    approve: [],
  },
};

/**
 * Check if a user can perform a specific action on a resource.
 */
export function can(
  user: SessionUser,
  resource: Resource,
  action: Action,
): boolean {
  const allowedRoles = permissionMatrix[resource]?.[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(user.role as Role);
}

// ─── Response Helpers ──────────────────────────────────────────

import { NextResponse } from "next/server";

/**
 * Returns a 403 Forbidden response if the user lacks the required permission.
 * Returns null if the user is authorized (so the route can proceed).
 *
 * Usage:
 * ```ts
 * const forbidden = requirePermission(user, "shifts", "create");
 * if (forbidden) return forbidden;
 * // ... proceed with route logic
 * ```
 */
export function requirePermission(
  user: SessionUser,
  resource: Resource,
  action: Action,
): NextResponse | null {
  if (!can(user, resource, action)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Sie haben keine Berechtigung für diese Aktion.",
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Returns a 403 if the user is not OWNER, ADMIN, or MANAGER.
 */
export function requireManagement(user: SessionUser): NextResponse | null {
  if (!isManagement(user)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message:
          "Diese Aktion ist nur für Inhaber, Admins und Manager verfügbar.",
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Returns a 403 if the user is not OWNER or ADMIN.
 */
export function requireAdmin(user: SessionUser): NextResponse | null {
  if (!isAdmin(user)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Diese Aktion ist nur für Inhaber und Admins verfügbar.",
      },
      { status: 403 },
    );
  }
  return null;
}
