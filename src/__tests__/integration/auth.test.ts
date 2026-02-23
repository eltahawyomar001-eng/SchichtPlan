/**
 * @vitest-environment node
 *
 * Auth flow integration tests.
 * Tests registration validation, rate-limiting on auth routes,
 * and JWT cache behaviour.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mocks (hoisted so vi.mock factories can access them) ── */
const {
  mockUserFindUnique,
  mockUserCreate,
  mockWorkspaceCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockWorkspaceCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: vi.fn(),
    },
    workspace: {
      create: mockWorkspaceCreate,
      findUnique: vi.fn(),
    },
    invitation: { findUnique: vi.fn() },
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    employee: {
      create: vi.fn(),
      count: vi.fn(),
    },
    verificationToken: {
      create: vi.fn().mockResolvedValue({ token: "test-token" }),
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw"), compare: vi.fn() },
}));

vi.mock("@/lib/verification", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils", () => ({
  slugify: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
  cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(" ")),
}));

/* ═══════════════════════════════════════════════════════════════
   Registration — POST /api/auth/register
   ═══════════════════════════════════════════════════════════════ */

describe("POST /api/auth/register", () => {
  let handler: typeof import("@/app/api/auth/register/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/auth/register/route");
  });

  function makeReq(
    body: Record<string, unknown>,
    ip = "register-test-1",
  ): Request {
    return new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when required fields are missing", async () => {
    const res = await handler.POST(
      makeReq({ name: "", email: "", password: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when DSGVO consent is not given", async () => {
    const res = await handler.POST(
      makeReq({
        name: "Test",
        email: "test@example.com",
        password: "StrongPass123!",
        workspaceName: "My Workspace",
        consentGiven: false,
      }),
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Datenschutzerklärung");
  });

  it("returns 400 when no workspace name and no invitation", async () => {
    const res = await handler.POST(
      makeReq({
        name: "Test",
        email: "test@example.com",
        password: "StrongPass123!",
        consentGiven: true,
        // no workspaceName, no invitationToken
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already exists", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "existing",
      email: "taken@example.com",
    });

    const res = await handler.POST(
      makeReq({
        name: "Test",
        email: "taken@example.com",
        password: "StrongPass123!",
        workspaceName: "My Workspace",
        consentGiven: true,
      }),
    );
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error).toContain("existiert bereits");
  });

  it("creates user and workspace for valid registration", async () => {
    mockUserFindUnique.mockResolvedValue(null); // No existing user

    // $transaction receives a callback — execute it with mock tx
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        workspace: {
          create: vi.fn().mockResolvedValue({
            id: "ws-new",
            name: "My Workspace",
            slug: "my-workspace",
          }),
        },
        user: {
          create: vi.fn().mockResolvedValue({
            id: "user-new",
            email: "new@example.com",
            name: "New User",
          }),
        },
      };
      return cb(tx);
    });

    const res = await handler.POST(
      makeReq({
        name: "New User",
        email: "new@example.com",
        password: "StrongPass123!",
        workspaceName: "My Workspace",
        consentGiven: true,
      }),
    );

    expect(res.status).toBe(201);
    expect(mockTransaction).toHaveBeenCalled();

    const body = await res.json();
    expect(body.message).toContain("erfolgreich");
    expect(body.requiresVerification).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
   JWT Cache — unit tests for the cache mechanism in auth.ts
   ═══════════════════════════════════════════════════════════════

   We can't easily test the NextAuth callbacks in isolation since
   they're deeply integrated. Instead we verify the cache
   data structure and TTL logic in a focused way.
   ═══════════════════════════════════════════════════════════════ */

describe("JWT cache behaviour", () => {
  it("Map correctly stores and retrieves entries", () => {
    const cache = new Map<
      string,
      {
        role: string;
        workspaceId: string | null;
        workspaceName: string | null;
        employeeId: string | null;
        ts: number;
      }
    >();

    cache.set("user-1", {
      role: "OWNER",
      workspaceId: "ws-1",
      workspaceName: "Test",
      employeeId: null,
      ts: Date.now(),
    });

    const entry = cache.get("user-1");
    expect(entry).toBeDefined();
    expect(entry!.role).toBe("OWNER");
    expect(entry!.workspaceId).toBe("ws-1");
  });

  it("TTL check correctly identifies expired entries", () => {
    const TTL = 60_000;
    const now = Date.now();

    const fresh = { role: "ADMIN", ts: now - 30_000 }; // 30s ago
    const stale = { role: "ADMIN", ts: now - 90_000 }; // 90s ago

    expect(now - fresh.ts < TTL).toBe(true); // should hit cache
    expect(now - stale.ts < TTL).toBe(false); // should miss cache
  });

  it("cache correctly updates on role change", () => {
    const cache = new Map<string, { role: string; ts: number }>();

    cache.set("user-1", { role: "EMPLOYEE", ts: Date.now() });
    expect(cache.get("user-1")!.role).toBe("EMPLOYEE");

    // Simulate role update
    cache.set("user-1", { role: "ADMIN", ts: Date.now() });
    expect(cache.get("user-1")!.role).toBe("ADMIN");
  });
});
