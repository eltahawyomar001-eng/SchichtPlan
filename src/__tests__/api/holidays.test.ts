/**
 * Tests for /api/holidays (GET) and /api/holidays/bundeslaender (GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession, mockPrisma } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
  mockPrisma: {
    workspace: { findUnique: vi.fn() },
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

import { buildOwner } from "../helpers/factories";

describe("GET /api/holidays", () => {
  let handler: typeof import("@/app/api/holidays/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/holidays/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request("http://localhost/api/holidays");
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns holidays for default year and bundesland", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    mockPrisma.workspace.findUnique.mockResolvedValue({ bundesland: "BY" });

    const req = new Request("http://localhost/api/holidays?year=2025");
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2025);
    expect(body.bundesland).toBe("BY");
    expect(Array.isArray(body.holidays)).toBe(true);
    expect(body.holidays.length).toBeGreaterThan(0);
  });

  it("uses query param bundesland over workspace setting", async () => {
    const owner = buildOwner();
    mockSession.user = owner;

    const req = new Request(
      "http://localhost/api/holidays?year=2025&bundesland=NW",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bundesland).toBe("NW");
  });
});

describe("GET /api/holidays/bundeslaender", () => {
  let handler: typeof import("@/app/api/holidays/bundeslaender/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/holidays/bundeslaender/route");
  });

  it("returns all 16 Bundesländer", async () => {
    const res = await handler.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(16);
    expect(body[0]).toHaveProperty("code");
    expect(body[0]).toHaveProperty("name");
  });
});
