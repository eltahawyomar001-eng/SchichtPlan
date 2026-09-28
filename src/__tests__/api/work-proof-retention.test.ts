/**
 * @vitest-environment node
 *
 * Proof photos are kept for the retention window, then removed from the
 * database AND from storage.
 *
 * The ordering is the part worth pinning down. Deleting the row first and then
 * failing to delete the object leaves bytes in the bucket that nothing
 * remembers, readable by anyone holding a signed URL and impossible to find
 * again. Failing the other way is recoverable: the row survives and the next
 * run retries it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockDeleteMany, mockDeleteObject } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockDeleteObject: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workProofPhoto: { findMany: mockFindMany, deleteMany: mockDeleteMany },
  },
}));
vi.mock("@/lib/work-proof-storage", () => ({
  deletePhotoObject: mockDeleteObject,
}));
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
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));

// Read from the route rather than repeated here: the window is a product
// decision that has already moved once, and a test restating the number would
// keep passing after the next change.
import { PROOF_RETENTION_DAYS } from "@/app/api/cron/work-proof-retention/route";

function req(secret = "test-secret"): Request {
  return new Request("http://localhost/api/cron/work-proof-retention", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("work-proof retention sweep", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    mockDeleteObject.mockResolvedValue(undefined);
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockFindMany.mockResolvedValue([]);
    handler = await import("@/app/api/cron/work-proof-retention/route");
  });

  it("refuses without the cron secret", async () => {
    const res = await handler.GET(req("wrong"));
    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("selects only photos older than the retention window", async () => {
    await handler.GET(req());

    const where = mockFindMany.mock.calls[0][0].where;
    const cutoff: Date = where.capturedAt.lt;
    const ageDays = (Date.now() - cutoff.getTime()) / 86_400_000;

    // Ninety days, give or take the moment the test runs. Asserted against the
    // exported constant so raising the window cannot silently pass a stale
    // expectation.
    expect(ageDays).toBeGreaterThan(PROOF_RETENTION_DAYS - 0.1);
    expect(ageDays).toBeLessThan(PROOF_RETENTION_DAYS + 0.1);
  });

  it("removes the stored image as well as the row", async () => {
    // A row deleted without its object leaves the photo in the bucket forever.
    mockFindMany.mockResolvedValue([
      { id: "p1", storagePath: "ws/emp/1.jpg" },
      { id: "p2", storagePath: "ws/emp/2.jpg" },
    ]);
    mockDeleteMany.mockResolvedValue({ count: 2 });

    const res = await handler.GET(req());
    const body = await res.json();

    expect(mockDeleteObject).toHaveBeenCalledWith("ws/emp/1.jpg");
    expect(mockDeleteObject).toHaveBeenCalledWith("ws/emp/2.jpg");
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
    });
    expect(body.deleted).toBe(2);
  });

  it("keeps the row when its object could not be deleted", async () => {
    // Orphaned bytes are the one outcome with no way back, so the row stays as
    // the only record that the object still needs removing.
    mockFindMany.mockResolvedValue([
      { id: "ok", storagePath: "ws/emp/ok.jpg" },
      { id: "bad", storagePath: "ws/emp/bad.jpg" },
    ]);
    mockDeleteObject.mockImplementation(async (path: string) => {
      if (path.includes("bad")) throw new Error("storage unavailable");
    });
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const res = await handler.GET(req());
    const body = await res.json();

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["ok"] } },
    });
    expect(body.objectsFailed).toBe(1);
  });

  it("does nothing when nothing has expired", async () => {
    const res = await handler.GET(req());
    const body = await res.json();

    expect(body.deleted).toBe(0);
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("reports when a full batch means more is waiting", async () => {
    // Silence here would look identical to a clean run while a backlog grows.
    mockFindMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({
        id: `p${i}`,
        storagePath: `ws/emp/${i}.jpg`,
      })),
    );
    mockDeleteMany.mockResolvedValue({ count: 500 });

    const body = await (await handler.GET(req())).json();
    expect(body.moreRemaining).toBe(true);
  });
});
