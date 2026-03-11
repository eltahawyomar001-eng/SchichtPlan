/**
 * Tests for /api/ical/tokens (GET, POST) and /api/docs (GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    iCalToken: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner, buildEmployee } from "../helpers/factories";

// ── /api/ical/tokens ──
describe("GET /api/ical/tokens", () => {
  let handler: typeof import("@/app/api/ical/tokens/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/ical/tokens/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns masked tokens for authenticated user", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.iCalToken.findMany.mockResolvedValue([
      {
        id: "t1",
        label: "Work Calendar",
        token:
          "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        lastUsedAt: null,
        rotatedAt: null,
        expiresAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    // Token should be masked
    expect(body.data[0].token).toMatch(/^…/);
    expect(body.data[0].token.length).toBeLessThan(20);
  });
});

describe("POST /api/ical/tokens", () => {
  let handler: typeof import("@/app/api/ical/tokens/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/ical/tokens/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/ical/tokens", {
      method: "POST",
      body: JSON.stringify({ label: "My Calendar" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(401);
  });

  it("creates token and returns it", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.iCalToken.create.mockResolvedValue({
      id: "t1",
      token: "full-token-value-here",
      label: "My Calendar",
      userId: owner.id,
      createdAt: new Date(),
    });

    const req = new Request("http://localhost/api/ical/tokens", {
      method: "POST",
      body: JSON.stringify({ label: "My Calendar" }),
    });
    const res = await handler.POST(req);
    expect(res.status).toBe(201);
  });
});

// ── /api/docs ──
describe("GET /api/docs", () => {
  let handler: typeof import("@/app/api/docs/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/docs/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE (requires admin)", async () => {
    mockSession.user = buildEmployee();
    const res = await handler.GET();
    expect(res.status).toBe(403);
  });

  it("returns OpenAPI spec for admin", async () => {
    mockSession.user = buildOwner();
    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe("3.0.3");
    expect(body.info.title).toBe("Shiftfy API");
  });
});
