/**
 * Tests for /api/onboarding/complete (POST)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    workspace: { update: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

describe("POST /api/onboarding/complete", () => {
  let handler: typeof import("@/app/api/onboarding/complete/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/onboarding/complete/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE (requires admin)", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(403);
  });

  it("marks onboarding completed for admin", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.workspace.update.mockResolvedValue({});

    const res = await handler.POST(new Request("http://localhost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
      where: { id: owner.workspaceId },
      data: { onboardingCompleted: true },
    });
  });
});
