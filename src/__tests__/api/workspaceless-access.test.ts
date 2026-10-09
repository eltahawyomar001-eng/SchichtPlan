/**
 * An account with no workspace must be refused, not served another tenant's row.
 *
 * These routes authenticated with getServerSession and then queried with
 * `where: { id, workspaceId: workspaceId ?? undefined }`. Prisma drops an
 * undefined key, so for a workspaceless account that `where` collapsed to
 * `{ id }` -- a primary-key lookup across every tenant in the database.
 *
 * A user reaches that state legitimately: removing somebody from a team
 * detaches them while leaving the account and its session intact.
 *
 * The test asserts the HTTP status and, crucially, that no query was issued
 * with an unscoped `where`. Status alone would pass even if the refusal
 * happened after a cross-tenant read.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const { mockSession, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
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
vi.mock("@/lib/db", () => {
  const prisma = {
    timeEntry: {
      findFirst: mockFindFirst,
      findMany: vi.fn().mockResolvedValue([]),
      update: mockUpdate,
    },
    timeEntryBreak: { findMany: vi.fn().mockResolvedValue([]) },
    shift: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return {
    prisma,
    withWorkspaceContext: (_w: string, fn: (t: unknown) => unknown) =>
      fn(prisma),
  };
});
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    withRequestId: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

/** Removed from their team: account intact, workspace gone. */
const workspaceless = (): SessionUser =>
  ({
    id: "u-orphan",
    email: "ex@example.test",
    role: "OWNER", // the default role survives removal, which makes this worse
    workspaceId: null,
    employeeId: null,
  }) as unknown as SessionUser;

const ctx = () => ({ params: Promise.resolve({ id: "te-foreign" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.user = workspaceless();
  // If the guard fails, the route finds a real row belonging to someone else.
  mockFindFirst.mockResolvedValue({
    id: "te-foreign",
    workspaceId: "ws-someone-else",
    employeeId: "emp-x",
    status: "ENTWURF",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    date: new Date("2026-10-09"),
  });
});

describe("a workspaceless account", () => {
  it("cannot read a foreign time entry", async () => {
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/time-entries/te-foreign"),
      ctx(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("NO_WORKSPACE");
  });

  it("never issues an unscoped query", async () => {
    // The important half. A 403 returned AFTER a cross-tenant read would still
    // have read the row, and `where: { id }` is what made that possible.
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    await GET(
      new Request("http://localhost/api/time-entries/te-foreign"),
      ctx(),
    );
    for (const call of mockFindFirst.mock.calls) {
      expect(call[0]?.where?.workspaceId).toBeDefined();
    }
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("cannot correct a foreign time entry", async () => {
    const { PATCH } = await import("@/app/api/time-entries/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/time-entries/te-foreign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: "09:00",
          changeReason: "nicht erlaubt",
        }),
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("cannot delete a foreign time entry", async () => {
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/time-entries/te-foreign", {
        method: "DELETE",
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
  });

  it("cannot record a lateness reason on a foreign entry", async () => {
    const { PATCH } =
      await import("@/app/api/time-entries/[id]/lateness-reason/route");
    const res = await PATCH(
      new Request(
        "http://localhost/api/time-entries/te-foreign/lateness-reason",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Zugausfall" }),
        },
      ),
      ctx(),
    );
    expect(res.status).toBe(403);
  });

  it("cannot confirm a break on a foreign entry", async () => {
    const { POST } = await import("@/app/api/time-entries/[id]/breaks/route");
    const res = await POST(
      new Request("http://localhost/api/time-entries/te-foreign/breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startOffsetMinutes: 240,
          endOffsetMinutes: 270,
        }),
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
  });

  it("is refused for a reason distinct from being unauthenticated", async () => {
    // 403, not 401: they are who they claim to be and simply belong nowhere.
    // Returning 401 would send a client round a pointless login loop.
    const { GET } = await import("@/app/api/time-entries/[id]/route");
    const authed = await GET(
      new Request("http://localhost/api/time-entries/te-foreign"),
      ctx(),
    );
    mockSession.user = null;
    const anon = await GET(
      new Request("http://localhost/api/time-entries/te-foreign"),
      ctx(),
    );
    expect(authed.status).toBe(403);
    expect(anon.status).toBe(401);
  });
});
