/**
 * @vitest-environment node
 *
 * Tests for GET and POST /api/sos/respond?token=<token>
 *
 * Token-gated (no auth) endpoints. The token IS the credential.
 * Tests cover: missing token, invalid token, already resolved, expired,
 * decline, concurrent accept race condition, and happy-path accept.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNotifFindUnique, mockNotifUpdate, mockTransaction, mockEmitSos } =
  vi.hoisted(() => ({
    mockNotifFindUnique: vi.fn(),
    mockNotifUpdate: vi.fn().mockResolvedValue({}),
    mockTransaction: vi.fn(),
    mockEmitSos: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    sosNotification: {
      findUnique: mockNotifFindUnique,
      update: mockNotifUpdate,
    },
    $transaction: mockTransaction,
  },
}));
vi.mock("@/lib/sos-events", () => ({ emitSosEvent: mockEmitSos }));
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

const future = new Date(Date.now() + 3_600_000); // 1 hour from now

const openNotif = {
  id: "notif1",
  employeeId: "emp1",
  sosRequestId: "sos1",
  tier: 1,
  linkOpenedAt: new Date(), // already opened
  response: "PENDING",
  employee: { id: "emp1", firstName: "Anna", lastName: "Schmidt" },
  sosRequest: {
    id: "sos1",
    status: "OPEN",
    expiresAt: future,
    filledById: null,
    shiftId: "s1",
    shift: { id: "s1", location: { name: "Main" } },
    bonusAmount: 0,
    bonusCurrency: "EUR",
    bonusNote: null,
  },
};

function makeUrl(path: string, token?: string) {
  const base = `http://localhost${path}`;
  return token ? `${base}?token=${token}` : base;
}

describe("GET /api/sos/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifFindUnique.mockResolvedValue(openNotif);
  });

  it("returns 400 when token is missing", async () => {
    const { GET } = await import("@/app/api/sos/respond/route");
    const res = await GET(new Request(makeUrl("/api/sos/respond")));
    expect(res.status).toBe(400);
  });

  it("returns 404 when token is invalid", async () => {
    mockNotifFindUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/sos/respond/route");
    const res = await GET(
      new Request(makeUrl("/api/sos/respond", "bad-token")),
    );
    expect(res.status).toBe(404);
  });

  it("returns alreadyResolved when SOS is already filled", async () => {
    mockNotifFindUnique.mockResolvedValue({
      ...openNotif,
      sosRequest: {
        ...openNotif.sosRequest,
        status: "FILLED",
        filledById: "emp2",
      },
    });
    const { GET } = await import("@/app/api/sos/respond/route");
    const res = await GET(new Request(makeUrl("/api/sos/respond", "abc")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyResolved).toBe(true);
  });

  it("returns expired when SOS has passed expiry", async () => {
    mockNotifFindUnique.mockResolvedValue({
      ...openNotif,
      sosRequest: {
        ...openNotif.sosRequest,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const { GET } = await import("@/app/api/sos/respond/route");
    const res = await GET(new Request(makeUrl("/api/sos/respond", "abc")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(true);
  });

  it("returns SOS details for a valid pending notification", async () => {
    const { GET } = await import("@/app/api/sos/respond/route");
    const res = await GET(
      new Request(makeUrl("/api/sos/respond", "valid-token")),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifId).toBe("notif1");
    expect(body.employee.firstName).toBe("Anna");
  });
});

describe("POST /api/sos/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifFindUnique.mockResolvedValue(openNotif);
    mockNotifUpdate.mockResolvedValue({});
    mockTransaction.mockResolvedValue({ ok: true });
  });

  it("returns 400 when token is missing", async () => {
    const { POST } = await import("@/app/api/sos/respond/route");
    const res = await POST(
      new Request(makeUrl("/api/sos/respond"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when action is invalid", async () => {
    const { POST } = await import("@/app/api/sos/respond/route");
    const res = await POST(
      new Request(makeUrl("/api/sos/respond", "tok"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "maybe" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when token is invalid", async () => {
    mockNotifFindUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sos/respond/route");
    const res = await POST(
      new Request(makeUrl("/api/sos/respond", "bad"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("records a decline and returns ok: false", async () => {
    const { POST } = await import("@/app/api/sos/respond/route");
    const res = await POST(
      new Request(makeUrl("/api/sos/respond", "tok"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(false);
  });

  it("accepts the shift and returns ok + accepted", async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          sosRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          sosNotification: {
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({}),
          },
          shift: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(mockTx);
      },
    );
    const { POST } = await import("@/app/api/sos/respond/route");
    const res = await POST(
      new Request(makeUrl("/api/sos/respond", "tok"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(true);
  });

  it("returns alreadyResolved when another accept won the race", async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          sosRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, // race lost
          sosNotification: { update: vi.fn(), updateMany: vi.fn() },
          shift: { update: vi.fn() },
        };
        return fn(mockTx);
      },
    );
    const { POST } = await import("@/app/api/sos/respond/route");
    const res = await POST(
      new Request(makeUrl("/api/sos/respond", "tok"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyResolved).toBe(true);
  });
});
