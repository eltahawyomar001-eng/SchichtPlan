/**
 * @vitest-environment node
 *
 * The evidence value of a proof photo rests entirely on the stamps being
 * ours. These assertions pin that down: the server's clock, the server's
 * distance verdict, storage's view of the file, and a workspace boundary that
 * cannot be crossed by claiming someone else's object path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEmployeeFindFirst,
  mockCreate,
  mockLocationFindFirst,
  mockTimeEntryFindFirst,
  mockShiftFindFirst,
  mockStat,
  mockDelete,
} = vi.hoisted(() => ({
  mockEmployeeFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockLocationFindFirst: vi.fn(),
  mockTimeEntryFindFirst: vi.fn(),
  mockShiftFindFirst: vi.fn(),
  mockStat: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    employee: { findFirst: mockEmployeeFindFirst },
    workProofPhoto: { create: mockCreate, findMany: vi.fn() },
    location: { findFirst: mockLocationFindFirst },
    timeEntry: { findFirst: mockTimeEntryFindFirst },
    shift: { findFirst: mockShiftFindFirst },
  },
}));
vi.mock("@/lib/work-proof-storage", async (importOriginal) => {
  const orig =
    await importOriginal<typeof import("@/lib/work-proof-storage")>();
  return {
    ...orig,
    statPhoto: mockStat,
    deletePhotoObject: mockDelete,
    createPhotoReadUrl: vi.fn(async () => "https://signed.example/x"),
  };
});
vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async () => ({
      ok: true,
      user: { id: "user-1" },
      workspaceId: "ws-1",
    })),
  };
});
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

function post(body: unknown) {
  return new Request("http://localhost/api/work-proof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  storagePath: "ws-1/emp-1/123-abc.jpg",
  fileName: "proof.jpg",
  latitude: 52.52,
  longitude: 13.405,
  accuracyM: 8,
  timeEntryId: "te-1",
};

describe("POST /api/work-proof", () => {
  let handler: typeof import("@/app/api/work-proof/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEmployeeFindFirst.mockResolvedValue({ id: "emp-1" });
    mockStat.mockResolvedValue({ size: 2_400_000, mimetype: "image/jpeg" });
    mockTimeEntryFindFirst.mockResolvedValue({ locationId: "loc-1" });
    mockLocationFindFirst.mockResolvedValue({
      latitude: 52.52,
      longitude: 13.405,
      geofenceRadiusMeters: 100,
      geofenceEnforced: true,
    });
    mockCreate.mockImplementation(async ({ data }) => ({
      id: "photo-1",
      capturedAt: new Date("2026-09-19T10:00:00.000Z"),
      geofenceStatus: data.geofenceStatus,
      distanceM: data.distanceM,
    }));
    handler = await import("@/app/api/work-proof/route");
  });

  it("stamps the position verdict server side, from the raw fix", async () => {
    const res = await handler.POST(post(VALID));
    expect(res.status).toBe(201);

    const written = mockCreate.mock.calls[0][0].data;
    // Same coordinates as the object, so it must land INSIDE with ~0 distance.
    expect(written.geofenceStatus).toBe("INSIDE");
    expect(written.distanceM).toBeLessThan(5);
    // The raw fix is retained for audit alongside the verdict.
    expect(written.latitude).toBe(52.52);
  });

  it("never lets the client dictate the verdict or the capture time", async () => {
    await handler.POST(
      post({
        ...VALID,
        // All of these are ignored: they are not in the accepted schema.
        geofenceStatus: "INSIDE",
        distanceM: 0,
        capturedAt: "2020-01-01T00:00:00.000Z",
        fileSize: 10,
        fileType: "image/jpeg",
      }),
    );
    const written = mockCreate.mock.calls[0][0].data;
    expect(written).not.toHaveProperty("capturedAt");
    // Size and type come from storage, not from the request body.
    expect(written.fileSize).toBe(BigInt(2_400_000));
    expect(written.fileType).toBe("image/jpeg");
  });

  it("records a spoofed fix as OUTSIDE and keeps the flag", async () => {
    await handler.POST(post({ ...VALID, mocked: true }));
    const written = mockCreate.mock.calls[0][0].data;
    expect(written.geofenceStatus).toBe("OUTSIDE");
    expect(written.locationMocked).toBe(true);
  });

  it("refuses an object path belonging to another workspace", async () => {
    const res = await handler.POST(
      post({ ...VALID, storagePath: "ws-2/emp-9/999-zzz.jpg" }),
    );
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses when the upload never actually landed", async () => {
    mockStat.mockResolvedValue(null);
    const res = await handler.POST(post(VALID));
    expect(res.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("deletes the object and refuses when storage reports a non-image", async () => {
    mockStat.mockResolvedValue({
      size: 1000,
      mimetype: "application/x-msdownload",
    });
    const res = await handler.POST(post(VALID));
    expect(res.status).toBe(415);
    expect(mockDelete).toHaveBeenCalledWith(VALID.storagePath);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("still records proof when the device has no position", async () => {
    const res = await handler.POST(
      post({ storagePath: VALID.storagePath, fileName: "p.jpg" }),
    );
    expect(res.status).toBe(201);
    const written = mockCreate.mock.calls[0][0].data;
    expect(written.geofenceStatus).toBe("UNAVAILABLE");
    expect(written.latitude).toBeNull();
  });

  it("refuses an account with no active employee record", async () => {
    mockEmployeeFindFirst.mockResolvedValue(null);
    const res = await handler.POST(post(VALID));
    expect(res.status).toBe(403);
  });
});
