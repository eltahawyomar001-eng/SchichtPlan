/**
 * @vitest-environment node
 *
 * POST /api/timesheet/ocr — extract, match/suggest, stage every row.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockUserFindUnique,
  mockEmployeeFindMany,
  mockImportCreate,
  mockEntryCreateMany,
  mockExtract,
  mockGetScanQuota,
  mockConsumeScan,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUserFindUnique: vi.fn(),
  mockEmployeeFindMany: vi.fn(),
  mockImportCreate: vi.fn(),
  mockEntryCreateMany: vi.fn(),
  mockExtract: vi.fn(),
  mockGetScanQuota: vi.fn(),
  mockConsumeScan: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/ai/timesheet-vision", () => ({ extractTimesheet: mockExtract }));
vi.mock("@/lib/timesheet-scanner-quota", () => ({
  getScanQuota: mockGetScanQuota,
  consumeScan: mockConsumeScan,
  quotaExceededPayload: (q: { tier: string; limit: number }) => ({
    error: "SCAN_QUOTA_EXCEEDED",
    tier: q.tier,
    limit: q.limit,
  }),
}));
vi.mock("@/lib/db", () => {
  const prisma = {
    user: { findUnique: mockUserFindUnique },
    employee: { findMany: mockEmployeeFindMany },
    timesheetImport: { create: mockImportCreate },
    timesheetImportEntry: { createManyAndReturn: mockEntryCreateMany },
  };
  return {
    prisma,
    withWorkspaceContext: (_w: string, fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
  };
});

import { POST } from "@/app/api/timesheet/ocr/route";

const MANAGER: SessionUser = {
  id: "u1",
  email: "boss@acme.de",
  role: "OWNER",
  workspaceId: "w1",
} as SessionUser;

function makeRequest(file = true) {
  const form = new FormData();
  if (file) {
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "sheet.jpg", {
        type: "image/jpeg",
      }),
    );
  }
  return new Request("http://localhost/api/timesheet/ocr", {
    method: "POST",
    body: form,
  });
}

const cs = { date: 0.9, shiftStart: 0.9, shiftEnd: 0.9 };
const ROW = {
  employeeName: null,
  date: "2026-06-10",
  shiftStart: "08:00",
  shiftEnd: "16:30",
  breakMinutes: 30,
  confidenceScores: cs,
};

function extractionWithHeader(
  name: string | null,
  personnelNumber: string | null,
) {
  return {
    source: "MOCK",
    employee: { name, personnelNumber, confidence: 0.95 },
    rows: [ROW],
  };
}

describe("POST /api/timesheet/ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = MANAGER;
    mockUserFindUnique.mockResolvedValue({ workspaceId: "w1" });
    // Default: quota available, consume is a noop.
    mockGetScanQuota.mockResolvedValue({
      tier: "free",
      limit: 30,
      used: 0,
      remaining: 30,
      resetAt: new Date(),
      blocked: false,
    });
    mockConsumeScan.mockResolvedValue(undefined);
    mockImportCreate.mockResolvedValue({
      id: "imp1",
      status: "PENDING_REVIEW",
      source: "MOCK",
    });
    // Echo the staged rows back in input order, as createManyAndReturn does.
    mockEntryCreateMany.mockImplementation(({ data }) =>
      Promise.resolve(
        data.map((d: Record<string, unknown>, i: number) => ({
          id: `ie${i}`,
          ...d,
        })),
      ),
    );
  });

  it("rejects non-management users", async () => {
    mockSession.user = { ...MANAGER, role: "EMPLOYEE" } as SessionUser;
    expect((await POST(makeRequest())).status).toBe(403);
  });

  it("400s when no file is supplied", async () => {
    expect((await POST(makeRequest(false))).status).toBe(400);
  });

  it("402s when the monthly scan quota is exhausted (no AI call)", async () => {
    mockGetScanQuota.mockResolvedValue({
      tier: "free",
      limit: 30,
      used: 30,
      remaining: 0,
      resetAt: new Date(),
      blocked: true,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe("SCAN_QUOTA_EXCEEDED");
    expect(mockExtract).not.toHaveBeenCalled();
    expect(mockConsumeScan).not.toHaveBeenCalled();
  });

  it("consumes one scan after a successful stage", async () => {
    mockEmployeeFindMany.mockResolvedValue([]);
    mockExtract.mockResolvedValue(extractionWithHeader("Max Mustermann", null));
    await POST(makeRequest());
    expect(mockConsumeScan).toHaveBeenCalledWith("w1");
  });

  it("matches the header employee by name and returns the employee list", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e1",
        firstName: "Max",
        lastName: "Mustermann",
        datevPersonnelNumber: null,
      },
    ]);
    mockExtract.mockResolvedValue(extractionWithHeader("Max Mustermann", null));

    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entries[0].employeeId).toBe("e1");
    expect(body.entries[0].matchKind).toBe("matched");
    expect(body.missingEmployees).toEqual([]);
    expect(body.workspaceEmployees).toEqual([
      { id: "e1", name: "Max Mustermann" },
    ]);
  });

  it("matches by Personal-Nr. even when the name differs", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e1",
        firstName: "Max",
        lastName: "Mustermann",
        datevPersonnelNumber: "123456",
      },
    ]);
    mockExtract.mockResolvedValue(
      extractionWithHeader("Maxx Mustermn", "123456"),
    );

    const body = await (await POST(makeRequest())).json();
    expect(body.entries[0].employeeId).toBe("e1");
    expect(body.missingEmployees).toEqual([]);
  });

  it("stages an unmatched-but-close name as a SUGGESTION (not blocked)", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e2",
        firstName: "Marie",
        lastName: "antointe",
        datevPersonnelNumber: null,
      },
    ]);
    mockExtract.mockResolvedValue(
      extractionWithHeader("Marie Antoinette", null),
    );

    const body = await (await POST(makeRequest())).json();
    expect(body.entries[0].employeeId).toBeNull();
    expect(body.entries[0].suggestedEmployeeId).toBe("e2");
    expect(body.entries[0].matchKind).toBe("suggested");
    // Suggested ≠ missing — manager confirms in the picker.
    expect(body.missingEmployees).toEqual([]);
  });

  it("reports a genuinely unknown name as missing (for invite)", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e1",
        firstName: "Max",
        lastName: "Mustermann",
        datevPersonnelNumber: null,
      },
    ]);
    mockExtract.mockResolvedValue(
      extractionWithHeader("Zacharias Unbekannt", null),
    );

    const body = await (await POST(makeRequest())).json();
    expect(body.entries[0].employeeId).toBeNull();
    expect(body.entries[0].matchKind).toBe("unmatched");
    expect(body.missingEmployees).toEqual(["Zacharias Unbekannt"]);
  });

  it("500s when extraction fails", async () => {
    mockEmployeeFindMany.mockResolvedValue([]);
    mockExtract.mockRejectedValue(new Error("extraction_failed"));
    expect((await POST(makeRequest())).status).toBe(500);
  });
});
