/**
 * @vitest-environment node
 *
 * Universal compliance gate + ArbZG §3 daily ceiling.
 *
 * These are the hard blocks the Zoll-Shield positioning is sold on, so the
 * cases that matter most are the ones where a block must NOT be released:
 * an unprivileged user asking for a bypass, a bypass with no justification,
 * and a bypass that names a different rule than the one that fired.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above the file body, so the spies they close
// over must be created with vi.hoisted rather than as plain top-level consts.
const { mockShiftFindMany, mockOverrideCreateMany, mockCheckCerts } =
  vi.hoisted(() => ({
    mockShiftFindMany: vi.fn(),
    mockOverrideCreateMany: vi.fn(),
    mockCheckCerts: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    shift: { findMany: mockShiftFindMany },
    complianceOverride: { createMany: mockOverrideCreateMany },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/certification-check", () => ({
  checkLocationCertifications: mockCheckCerts,
  describeCertViolations: () => "fehlende Zertifikate: §34a Sachkunde",
}));

import { checkArbZg3MaxDaily } from "@/lib/arbzg";
import {
  assertShiftCompliance,
  evaluateShiftCompliance,
  ComplianceError,
  isComplianceError,
} from "@/lib/compliance-gate";
import type { SessionUser } from "@/lib/types";

const admin = { id: "u-admin", role: "ADMIN" } as SessionUser;
const employee = { id: "u-emp", role: "EMPLOYEE" } as SessionUser;

// A compliant 8h shift with a lawful 30min break.
const okShift = {
  employeeId: "e-1",
  locationId: "loc-1",
  date: "2026-09-01",
  startTime: "08:00",
  endTime: "16:30",
  breakMinutes: 30,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockShiftFindMany.mockResolvedValue([]);
  mockCheckCerts.mockResolvedValue([]);
  mockOverrideCreateMany.mockResolvedValue({ count: 1 });
});

// ─── ArbZG §3 ───────────────────────────────────────────────────

describe("checkArbZg3MaxDaily — ArbZG §3 hard block", () => {
  it("passes when the day total stays at the 10h ceiling", async () => {
    mockShiftFindMany.mockResolvedValue([
      { startTime: "06:00", endTime: "12:00", breakMinutes: 0 }, // 360
    ]);
    const r = await checkArbZg3MaxDaily("e-1", "2026-09-01", 240); // +240 = 600
    expect(r.violation).toBe(false);
    expect(r.totalMinutes).toBe(600);
  });

  it("blocks when the day total exceeds 10h", async () => {
    mockShiftFindMany.mockResolvedValue([
      { startTime: "06:00", endTime: "12:00", breakMinutes: 0 }, // 360
    ]);
    const r = await checkArbZg3MaxDaily("e-1", "2026-09-01", 241); // 601
    expect(r.violation).toBe(true);
    expect(r.message).toContain("ArbZG §3");
    expect(r.messageEn).toContain("10 hours");
  });

  it("nets existing shifts by their break, not gross attendance", async () => {
    // 12h attendance minus 45min break = 11h15 net → already over on its own.
    mockShiftFindMany.mockResolvedValue([
      { startTime: "06:00", endTime: "18:00", breakMinutes: 45 },
    ]);
    const r = await checkArbZg3MaxDaily("e-1", "2026-09-01", 0);
    expect(r.existingMinutes).toBe(675);
    expect(r.violation).toBe(true);
  });

  it("counts an overnight existing shift correctly", async () => {
    mockShiftFindMany.mockResolvedValue([
      { startTime: "22:00", endTime: "06:00", breakMinutes: 0 }, // 480
    ]);
    const r = await checkArbZg3MaxDaily("e-1", "2026-09-01", 60);
    expect(r.existingMinutes).toBe(480);
    expect(r.violation).toBe(false);
  });

  it("excludes the shift being edited from the daily total", async () => {
    await checkArbZg3MaxDaily("e-1", "2026-09-01", 60, {
      excludeShiftId: "s-9",
      workspaceId: "ws-1",
    });
    expect(mockShiftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "s-9" } }),
      }),
    );
  });

  it("ignores soft-deleted shifts", async () => {
    await checkArbZg3MaxDaily("e-1", "2026-09-01", 60);
    expect(mockShiftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});

// ─── Gate: evaluation ───────────────────────────────────────────

describe("evaluateShiftCompliance", () => {
  it("returns no violations for a lawful shift", async () => {
    expect(await evaluateShiftCompliance(okShift, "ws-1")).toEqual([]);
  });

  it("flags §4 even when the shift is unassigned", async () => {
    const v = await evaluateShiftCompliance(
      { ...okShift, employeeId: null, breakMinutes: 0 },
      "ws-1",
    );
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("ARBZG_4");
  });

  it("skips per-employee checks when nobody is assigned", async () => {
    await evaluateShiftCompliance({ ...okShift, employeeId: null }, "ws-1");
    expect(mockCheckCerts).not.toHaveBeenCalled();
    expect(mockShiftFindMany).not.toHaveBeenCalled();
  });

  it("surfaces a §34a certification failure", async () => {
    mockCheckCerts.mockResolvedValue([{ reason: "NO_34A_QUALIFICATION" }]);
    const v = await evaluateShiftCompliance(okShift, "ws-1");
    expect(v.map((x) => x.rule)).toContain("SACHKUNDE_34A");
  });
});

// ─── Gate: assertion and overrides ──────────────────────────────

describe("assertShiftCompliance", () => {
  it("resolves quietly when the shift is compliant", async () => {
    const r = await assertShiftCompliance(okShift, "ws-1");
    expect(r.overridden).toEqual([]);
    expect(r.pendingOverrides).toEqual([]);
  });

  it("throws a structured 422 ComplianceError on violation", async () => {
    mockCheckCerts.mockResolvedValue([{ reason: "BEWACHER_ID_MISSING" }]);
    const err = await assertShiftCompliance(okShift, "ws-1").catch((e) => e);
    expect(isComplianceError(err)).toBe(true);
    expect((err as ComplianceError).status).toBe(422);
    expect((err as ComplianceError).violations[0].rule).toBe("SACHKUNDE_34A");
  });

  it("REFUSES an override from a non-management user", async () => {
    mockCheckCerts.mockResolvedValue([{ reason: "BEWACHER_ID_MISSING" }]);
    const err = await assertShiftCompliance(okShift, "ws-1", {
      rules: ["SACHKUNDE_34A"],
      reason: "Kunde besteht auf diesem Mitarbeiter",
      user: employee,
    }).catch((e) => e);
    expect(isComplianceError(err)).toBe(true);
    expect(mockOverrideCreateMany).not.toHaveBeenCalled();
  });

  it("REFUSES an override with a blank reason", async () => {
    mockCheckCerts.mockResolvedValue([{ reason: "BEWACHER_ID_MISSING" }]);
    const err = await assertShiftCompliance(okShift, "ws-1", {
      rules: ["SACHKUNDE_34A"],
      reason: "   ",
      user: admin,
    }).catch((e) => e);
    expect(isComplianceError(err)).toBe(true);
    expect(mockOverrideCreateMany).not.toHaveBeenCalled();
  });

  it("REFUSES to release a rule the dispatcher did not name", async () => {
    // §34a fired, but only §4 was released — the block must stand.
    mockCheckCerts.mockResolvedValue([{ reason: "BEWACHER_ID_MISSING" }]);
    const err = await assertShiftCompliance(okShift, "ws-1", {
      rules: ["ARBZG_4"],
      reason: "Pause wird vor Ort nachgeholt",
      user: admin,
    }).catch((e) => e);
    expect(isComplianceError(err)).toBe(true);
    expect((err as ComplianceError).violations[0].rule).toBe("SACHKUNDE_34A");
  });

  it("releases a named rule for management and returns it pending on create", async () => {
    mockCheckCerts.mockResolvedValue([{ reason: "BEWACHER_ID_MISSING" }]);
    const r = await assertShiftCompliance(okShift, "ws-1", {
      rules: ["SACHKUNDE_34A"],
      reason: "Nachweis liegt in Papierform vor, Registereintrag läuft",
      user: admin,
    });
    expect(r.overridden).toHaveLength(1);
    // Creation has no shift id yet, so nothing is written until the insert.
    expect(mockOverrideCreateMany).not.toHaveBeenCalled();
    expect(r.pendingOverrides[0]).toMatchObject({
      rule: "SACHKUNDE_34A",
      overriddenBy: "u-admin",
      workspaceId: "ws-1",
    });
  });

  it("writes the override immediately when editing an existing shift", async () => {
    mockCheckCerts.mockResolvedValue([{ reason: "BEWACHER_ID_MISSING" }]);
    const r = await assertShiftCompliance(
      { ...okShift, excludeShiftId: "s-42" },
      "ws-1",
      {
        rules: ["SACHKUNDE_34A"],
        reason: "Nachweis liegt in Papierform vor",
        user: admin,
      },
    );
    expect(mockOverrideCreateMany).toHaveBeenCalledTimes(1);
    expect(mockOverrideCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          rule: "SACHKUNDE_34A",
          entityType: "Shift",
          entityId: "s-42",
          overriddenBy: "u-admin",
        }),
      ],
    });
    expect(r.pendingOverrides).toEqual([]);
  });
});
