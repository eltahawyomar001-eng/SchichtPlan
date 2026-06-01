/**
 * @vitest-environment node
 *
 * Tests for POST /api/station/authorize + GET /api/station/recent-punch
 *
 * station/authorize: public — exchanges a setup token for a 30-day access key.
 * station/recent-punch: station-key cookie authenticated — polls for recent clocks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockWorkspaceFindUnique,
  mockSessionCreate,
  mockVerifySetup,
  mockGenerateAccess,
  mockVerifyAccess,
  mockTimeEntryFindFirst,
} = vi.hoisted(() => ({
  mockWorkspaceFindUnique: vi.fn(),
  mockSessionCreate: vi.fn().mockResolvedValue({}),
  mockVerifySetup: vi.fn(),
  mockGenerateAccess: vi.fn(),
  mockVerifyAccess: vi.fn().mockReturnValue("ws1"), // valid station key by default
  mockTimeEntryFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: { findUnique: mockWorkspaceFindUnique },
    stationSession: { create: mockSessionCreate },
    timeEntry: { findFirst: mockTimeEntryFindFirst },
  },
}));
vi.mock("@/lib/station-token", () => ({
  verifyStationSetupToken: mockVerifySetup,
  generateStationAccessToken: mockGenerateAccess,
  verifyStationAccessToken: mockVerifyAccess,
}));
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
// Cookie returns a valid station key for all tests — individual tests can override mockVerifyAccess
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) =>
      name === "station_key" ? { value: "valid-key" } : undefined,
    ),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

const postReq = (body: object) =>
  new Request("http://localhost/api/station/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/station/authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when setupToken is missing", async () => {
    const { POST } = await import("@/app/api/station/authorize/route");
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("MISSING_TOKEN");
  });

  it("returns 401 when setupToken is invalid", async () => {
    mockVerifySetup.mockReturnValue(null);
    const { POST } = await import("@/app/api/station/authorize/route");
    const res = await POST(postReq({ setupToken: "bad-token" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("returns 404 when workspace not found", async () => {
    mockVerifySetup.mockReturnValue("ws1");
    mockWorkspaceFindUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/station/authorize/route");
    const res = await POST(postReq({ setupToken: "valid-setup" }));
    expect(res.status).toBe(404);
  });

  it("exchanges setup token for access key and returns workspaceName", async () => {
    mockVerifySetup.mockReturnValue("ws1");
    mockWorkspaceFindUnique.mockResolvedValue({ name: "Shiftfy GmbH" });
    mockGenerateAccess.mockReturnValue({
      token: "access-key-123",
      expiresAt: Date.now() + 30 * 86400000,
    });
    mockSessionCreate.mockResolvedValue({});
    const { POST } = await import("@/app/api/station/authorize/route");
    const res = await POST(postReq({ setupToken: "valid-setup" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // stationKey is delivered via Set-Cookie, not in the JSON body
    expect(body.workspaceName).toBe("Shiftfy GmbH");
    expect(body.expiresAt).toBeDefined();
  });
});

describe("GET /api/station/recent-punch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAccess.mockReturnValue("ws1");
  });

  it("returns 401 when station_key token is invalid", async () => {
    mockVerifyAccess.mockReturnValue(null); // invalid key
    const { GET } = await import("@/app/api/station/recent-punch/route");
    const res = await GET(
      new Request("http://localhost/api/station/recent-punch"),
    );
    expect(res.status).toBe(401);
  });

  it("returns null punch when no recent activity", async () => {
    mockTimeEntryFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/station/recent-punch/route");
    const res = await GET(
      new Request("http://localhost/api/station/recent-punch"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.punch).toBeNull();
  });

  it("returns recent clock-in event with action:in", async () => {
    mockTimeEntryFindFirst.mockResolvedValue({
      id: "te1",
      clockInAt: new Date(),
      clockOutAt: null,
      employee: { firstName: "Anna" },
    });
    const { GET } = await import("@/app/api/station/recent-punch/route");
    const res = await GET(
      new Request("http://localhost/api/station/recent-punch"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.punch).toBeDefined();
    expect(body.punch.action).toBe("in");
    expect(body.punch.employeeName).toBe("Anna");
  });
});
