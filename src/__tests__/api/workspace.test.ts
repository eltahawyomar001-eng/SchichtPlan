/**
 * @vitest-environment node
 *
 * Tests for Workspace API:
 *   GET   /api/workspace — get workspace settings
 *   PATCH /api/workspace — update workspace settings
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockWorkspaceFindUnique, mockWorkspaceUpdate } =
  vi.hoisted(() => ({
    mockSession: { user: null as SessionUser | null },
    mockWorkspaceFindUnique: vi.fn(),
    mockWorkspaceUpdate: vi.fn(),
  }));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: {
      findUnique: mockWorkspaceFindUnique,
      update: mockWorkspaceUpdate,
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  },
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildOwner,
  buildAdmin,
  buildEmployee,
  buildManager,
} from "../helpers/factories";

function patchReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/workspace", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/workspace", () => {
  let handler: typeof import("@/app/api/workspace/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/workspace/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns workspace for admin", async () => {
    mockSession.user = buildAdmin();
    mockWorkspaceFindUnique.mockResolvedValue({
      id: "ws-1",
      name: "Test Company",
      slug: "test",
      bundesland: "HE",
    });

    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Test Company");
  });

  it("returns 404 when workspace not found", async () => {
    mockSession.user = buildAdmin();
    mockWorkspaceFindUnique.mockResolvedValue(null);

    const res = await handler.GET();
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/workspace", () => {
  let handler: typeof import("@/app/api/workspace/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/workspace/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.PATCH(patchReq({ name: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when EMPLOYEE tries to update", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.PATCH(patchReq({ name: "New Name" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when MANAGER tries to update", async () => {
    mockSession.user = buildManager();
    const res = await handler.PATCH(patchReq({ name: "New Name" }));
    expect(res.status).toBe(403);
  });

  it("OWNER can update workspace", async () => {
    mockSession.user = buildOwner();
    mockWorkspaceUpdate.mockResolvedValue({
      id: "ws-1",
      name: "Updated Name",
    });

    const res = await handler.PATCH(patchReq({ name: "Updated Name" }));
    expect(res.status).toBe(200);
  });

  it("ADMIN can update workspace", async () => {
    mockSession.user = buildAdmin();
    mockWorkspaceUpdate.mockResolvedValue({
      id: "ws-1",
      name: "Admin Update",
    });

    const res = await handler.PATCH(patchReq({ name: "Admin Update" }));
    expect(res.status).toBe(200);
  });
});
