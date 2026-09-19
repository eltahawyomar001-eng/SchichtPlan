/**
 * @vitest-environment node
 *
 * Accepting an invitation must work for someone who already has an account.
 *
 * Employee.userId carries a GLOBAL unique index, so one user account can hold
 * exactly one employee link anywhere in the database. Registration creates an
 * employee row for every owner, so anybody who signed up on their own already
 * holds that link — and accepting an invitation then tried to take a second
 * one, tripping P2002, which surfaced to the invited colleague as a bare
 * "Conflict". That is the common case, not an edge case: the only people it
 * ever worked for were users who had never had an account at all.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInvitationFindFirst,
  mockUserFindUnique,
  mockUserCount,
  mockTransaction,
  tx,
} = vi.hoisted(() => {
  const tx = {
    invitation: { updateMany: vi.fn() },
    user: { update: vi.fn() },
    employee: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    mockInvitationFindFirst: vi.fn(),
    mockUserFindUnique: vi.fn(),
    mockUserCount: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction: vi.fn(async (cb: any) => cb(tx)),
    tx,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    invitation: { findFirst: mockInvitationFindFirst },
    user: { findUnique: mockUserFindUnique, count: mockUserCount },
    $transaction: mockTransaction,
  },
}));
vi.mock("@/lib/cache", () => ({
  cache: { get: vi.fn(async () => null), set: vi.fn(), del: vi.fn() },
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withRequestId: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));
vi.mock("@/lib/employee-pin", () => ({
  generateUniquePin: vi.fn(async () => "1234"),
  hashPin: vi.fn(async () => "hash"),
  sendPinEmail: vi.fn(async () => undefined),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async () => ({
      ok: true,
      user: {
        id: "user-1",
        email: "invited@example.com",
        name: "Omar Rageh",
        workspaceId: "ws-own",
      },
      workspaceId: "ws-own",
    })),
  };
});

const TARGET_WS = "ws-target";

describe("accepting an invitation as an existing account holder", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInvitationFindFirst.mockResolvedValue({
      id: "inv-1",
      email: "invited@example.com",
      role: "EMPLOYEE",
      status: "PENDING",
      workspaceId: TARGET_WS,
      expiresAt: new Date(Date.now() + 864e5),
    });
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "invited@example.com",
      // Already owns their own workspace, as any self-signup does.
      workspaceId: "ws-own",
    });
    mockUserCount.mockResolvedValue(1); // sole member of their own workspace
    tx.invitation.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({});
    tx.employee.updateMany.mockResolvedValue({ count: 1 });
    tx.employee.findFirst.mockResolvedValue({ id: "emp-target" });
    tx.employee.update.mockResolvedValue({});
    handler = await import("@/app/api/invitations/token/[token]/route");
  });

  function req() {
    return new Request("http://localhost/api/invitations/token/tok-1", {
      method: "POST",
    });
  }

  it("releases the prior employee link before claiming the new one", async () => {
    await handler.POST(req(), { params: Promise.resolve({ token: "tok-1" }) });

    expect(tx.employee.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", workspaceId: { not: TARGET_WS } },
      data: { userId: null },
    });

    // Order matters: releasing must happen before the new link is taken, or
    // the global unique index on userId rejects the write.
    const releaseOrder = tx.employee.updateMany.mock.invocationCallOrder[0];
    const claimOrder = tx.employee.update.mock.invocationCallOrder[0];
    expect(releaseOrder).toBeLessThan(claimOrder);
  });

  it("keeps the old employee row, only unlinking it", async () => {
    await handler.POST(req(), { params: Promise.resolve({ token: "tok-1" }) });
    // Time entries on that row are subject to ArbZG §16 retention — the person
    // left the workspace, their historical record did not.
    const call = tx.employee.updateMany.mock.calls[0][0];
    expect(call.data).toEqual({ userId: null });
    expect(call.data).not.toHaveProperty("deletedAt");
  });

  it("links the employee row waiting in the target workspace", async () => {
    await handler.POST(req(), { params: Promise.resolve({ token: "tok-1" }) });
    expect(tx.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-target" },
        data: { userId: "user-1" },
      }),
    );
    expect(tx.employee.create).not.toHaveBeenCalled();
  });

  it("still refuses to pull someone out of a shared workspace", async () => {
    mockUserCount.mockResolvedValue(3);
    const res = await handler.POST(req(), {
      params: Promise.resolve({ token: "tok-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    // A named reason the page can translate, never a bare HTTP status.
    expect(body.error).toBe("ALREADY_IN_WORKSPACE");
    expect(tx.employee.updateMany).not.toHaveBeenCalled();
  });
});
