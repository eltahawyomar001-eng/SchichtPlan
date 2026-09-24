/**
 * @vitest-environment node
 *
 * Which object a punch or proof is measured against.
 *
 * This is the step that was silently returning nothing. A site could be
 * geocoded, enforced and given a radius, and every proof photo still read
 * "Site not geocoded" -- because nothing connected the photo to the site. The
 * screen showing the problem was not the screen with the gap, which is what
 * made it so hard to see.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockTimeEntryFindFirst,
  mockShiftFindFirst,
  mockEmployeeFindFirst,
  mockLocationFindMany,
} = vi.hoisted(() => ({
  mockTimeEntryFindFirst: vi.fn(),
  mockShiftFindFirst: vi.fn(),
  mockEmployeeFindFirst: vi.fn(),
  mockLocationFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    timeEntry: { findFirst: mockTimeEntryFindFirst },
    shift: { findFirst: mockShiftFindFirst },
    employee: { findFirst: mockEmployeeFindFirst },
    location: { findMany: mockLocationFindMany },
  },
}));

import { resolveGeofenceTargetId } from "@/lib/geofence-target";

const WS = "ws-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockTimeEntryFindFirst.mockResolvedValue(null);
  mockShiftFindFirst.mockResolvedValue(null);
  mockEmployeeFindFirst.mockResolvedValue(null);
  mockLocationFindMany.mockResolvedValue([]);
});

describe("resolveGeofenceTargetId", () => {
  it("prefers what the client explicitly chose", async () => {
    // A scanned QR station is the strongest claim there is about where
    // somebody is standing.
    await expect(
      resolveGeofenceTargetId(WS, { locationId: "explicit", shiftId: "s1" }),
    ).resolves.toBe("explicit");
    expect(mockShiftFindFirst).not.toHaveBeenCalled();
  });

  it("falls back through entry, shift, then the employee's own object", async () => {
    mockEmployeeFindFirst.mockResolvedValue({ locationId: "emp-loc" });

    await expect(
      resolveGeofenceTargetId(WS, {
        timeEntryId: "te1",
        shiftId: "s1",
        employeeId: "e1",
      }),
    ).resolves.toBe("emp-loc");
  });

  it("uses the workspace's only object when nothing else says", async () => {
    // The case that makes a small customer's geofence work at all: one site,
    // geocoded and enforced, and nobody assigned to it -- because with a single
    // object there is nothing to choose between.
    mockLocationFindMany.mockResolvedValue([{ id: "only-one" }]);

    await expect(
      resolveGeofenceTargetId(WS, { employeeId: "e1" }),
    ).resolves.toBe("only-one");
  });

  it("refuses to guess when the workspace has more than one", async () => {
    // Putting a worker at the wrong site produces a confident OUTSIDE verdict
    // that is simply false, and it is kept as evidence. No verdict is better.
    mockLocationFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);

    await expect(
      resolveGeofenceTargetId(WS, { employeeId: "e1" }),
    ).resolves.toBeNull();
  });

  it("ignores deleted objects when deciding it is unambiguous", async () => {
    await resolveGeofenceTargetId(WS, {});
    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WS, deletedAt: null },
      }),
    );
  });

  it("scopes every lookup to the workspace", async () => {
    // Resolving another tenant's object would leak its coordinates into this
    // one's evidence trail.
    mockTimeEntryFindFirst.mockResolvedValue({ locationId: "te-loc" });

    await resolveGeofenceTargetId(WS, { timeEntryId: "te1" });

    expect(mockTimeEntryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "te1", workspaceId: WS },
      }),
    );
  });

  it("returns null when there is genuinely nothing to measure against", async () => {
    await expect(resolveGeofenceTargetId(WS, {})).resolves.toBeNull();
  });
});
