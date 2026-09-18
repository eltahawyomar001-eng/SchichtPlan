/**
 * @vitest-environment node
 *
 * End-to-end distribution check for the real solver.
 *
 * Reproduces the roster that exposed the bug: thirteen employees, nine
 * identical weekday shifts, fairness turned up to 100. One employee had no
 * contracted hours recorded, which pinned their fairness score at maximum
 * forever — they took eight of the nine shifts and a second employee took the
 * last one, leaving eleven people with nothing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEmployeeFindMany, mockShiftFindMany, mockStaffingFindMany } =
  vi.hoisted(() => ({
    mockEmployeeFindMany: vi.fn(),
    mockShiftFindMany: vi.fn(),
    mockStaffingFindMany: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    employee: { findMany: mockEmployeeFindMany },
    shift: { findMany: mockShiftFindMany, findUnique: vi.fn() },
    staffingRequirement: { findMany: mockStaffingFindMany },
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Nine weekday shifts, 06:30–17:00 with a 45-minute break, one location. */
const SHIFT_DATES = [
  "2026-09-18",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
  "2026-09-25",
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
];

const CONTRACTS = [40, 40, 40, 40, 40, 40, 40, 38, 35, 30, 25, 20];

function buildEmployees() {
  // The employee with no contract hours is FIRST, as they were in the real
  // query order — that is what let them win every tie.
  return [
    {
      id: "emp-no-contract",
      firstName: "Jamal",
      lastName: "Bowman",
      weeklyHours: null,
      workDaysPerWeek: 5,
      hourlyRate: null,
      isActive: true,
      absenceRequests: [],
      employeeSkills: [],
      availabilities: [],
      departments: [],
    },
    ...CONTRACTS.map((h, i) => ({
      id: `emp-${i}`,
      firstName: `Mitarbeiter${i}`,
      lastName: "Test",
      weeklyHours: h,
      workDaysPerWeek: 5,
      hourlyRate: 20,
      isActive: true,
      absenceRequests: [],
      employeeSkills: [],
      availabilities: [],
      departments: [],
    })),
  ];
}

function buildOpenShifts() {
  return SHIFT_DATES.map((d, i) => ({
    id: `shift-${i}`,
    date: new Date(`${d}T00:00:00.000Z`),
    startTime: "06:30",
    endTime: "17:00",
    breakMinutes: 45,
    employeeId: null,
    locationId: "loc-1",
    location: { name: "Objekt 1" },
    status: "OPEN",
  }));
}

describe("auto-scheduler load distribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmployeeFindMany.mockResolvedValue(buildEmployees());
    mockStaffingFindMany.mockResolvedValue([]);
    // First call loads open shifts; second loads already-assigned ones.
    mockShiftFindMany
      .mockResolvedValueOnce(buildOpenShifts())
      .mockResolvedValueOnce([]);
  });

  it("spreads nine shifts across many employees, not one", async () => {
    const { runAutoScheduler } = await import("@/lib/auto-scheduler");

    const result = await runAutoScheduler({
      workspaceId: "ws-1",
      startDate: new Date("2026-09-18T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      bundesland: "BE",
      weights: {
        fairness: 100,
        preference: 0,
        cost: 0,
        continuity: 0,
        staffing: 0,
        fatigue: 0,
        rotation: 0,
      },
    });

    expect(result.assignments).toHaveLength(SHIFT_DATES.length);

    const perEmployee = new Map<string, number>();
    for (const a of result.assignments) {
      perEmployee.set(a.employeeId, (perEmployee.get(a.employeeId) ?? 0) + 1);
    }

    const counts = [...perEmployee.values()].sort((a, b) => b - a);

    // The defect produced [8, 1]. With fairness at 100 and nine identical
    // shifts, no one should be carrying a large share of the roster.
    expect(counts[0]).toBeLessThanOrEqual(2);
    expect(perEmployee.size).toBeGreaterThanOrEqual(5);
  });

  it("does not hand the whole roster to the employee with no contract hours", async () => {
    const { runAutoScheduler } = await import("@/lib/auto-scheduler");

    const result = await runAutoScheduler({
      workspaceId: "ws-1",
      startDate: new Date("2026-09-18T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      bundesland: "BE",
      weights: { fairness: 100 },
    });

    const theirs = result.assignments.filter(
      (a) => a.employeeId === "emp-no-contract",
    );
    expect(theirs.length).toBeLessThanOrEqual(2);
  });
});
