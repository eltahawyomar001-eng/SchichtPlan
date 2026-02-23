import type { SessionUser } from "@/lib/types";
import type { Role } from "@/lib/authorization";

/* ── User / Session Factories ── */

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `test-id-${idCounter}`;
}

export function buildSessionUser(
  overrides: Partial<SessionUser> = {},
): SessionUser {
  return {
    id: nextId(),
    email: "test@example.com",
    name: "Test User",
    role: "OWNER",
    workspaceId: `ws-${nextId()}`,
    workspaceName: "Test Workspace",
    employeeId: null,
    ...overrides,
  };
}

export function buildOwner(overrides: Partial<SessionUser> = {}): SessionUser {
  return buildSessionUser({ role: "OWNER", ...overrides });
}

export function buildAdmin(overrides: Partial<SessionUser> = {}): SessionUser {
  return buildSessionUser({ role: "ADMIN", ...overrides });
}

export function buildManager(
  overrides: Partial<SessionUser> = {},
): SessionUser {
  return buildSessionUser({ role: "MANAGER", ...overrides });
}

export function buildEmployee(
  overrides: Partial<SessionUser> = {},
): SessionUser {
  return buildSessionUser({ role: "EMPLOYEE", ...overrides });
}

/* ── Request Factory ── */

export function buildRequest(
  url = "http://localhost:3000/api/test",
  init: RequestInit & { headers?: Record<string, string> } = {},
): Request {
  const { headers: customHeaders, ...rest } = init;
  return new Request(url, {
    headers: {
      "x-forwarded-for": "127.0.0.1",
      ...customHeaders,
    },
    ...rest,
  });
}

/**
 * Build a request with a distinct IP for rate-limit testing.
 */
export function buildRequestWithIp(
  ip: string,
  url = "http://localhost:3000/api/test",
): Request {
  return new Request(url, {
    headers: { "x-forwarded-for": ip },
  });
}

/* ── Role Helpers ── */

export const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"];
export const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"];
export const MANAGEMENT_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER"];
