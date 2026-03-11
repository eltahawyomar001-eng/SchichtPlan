/**
 * Tests for /api/e-signatures (GET)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession } = vi.hoisted(() => ({
  mockSession: {
    user: null as ReturnType<
      typeof import("../helpers/factories").buildOwner
    > | null,
  },
}));

const mockESignature = vi.hoisted(() => ({
  getSignaturesForEntity: vi.fn(),
  verifySignatureIntegrity: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/e-signature", () => mockESignature);
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildOwner } from "../helpers/factories";

describe("GET /api/e-signatures", () => {
  let handler: typeof import("@/app/api/e-signatures/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/e-signatures/route");
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.user = null;
    const req = new Request(
      "http://localhost/api/e-signatures?entityType=AbsenceRequest&entityId=a1",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when entityType or entityId is missing", async () => {
    mockSession.user = buildOwner();
    const req = new Request("http://localhost/api/e-signatures");
    const res = await handler.GET(req);
    expect(res.status).toBe(400);
  });

  it("returns signatures with integrity verification", async () => {
    const owner = buildOwner();
    mockSession.user = owner;
    const sigs = [
      { id: "s1", entityType: "AbsenceRequest", entityId: "a1", hash: "abc" },
    ];
    mockESignature.getSignaturesForEntity.mockResolvedValue(sigs);
    mockESignature.verifySignatureIntegrity.mockReturnValue(true);

    const req = new Request(
      "http://localhost/api/e-signatures?entityType=AbsenceRequest&entityId=a1",
    );
    const res = await handler.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].isValid).toBe(true);
    expect(mockESignature.getSignaturesForEntity).toHaveBeenCalledWith(
      "AbsenceRequest",
      "a1",
      owner.workspaceId,
    );
  });
});
