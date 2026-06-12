/**
 * @vitest-environment node
 *
 * POST /api/timesheet/ocr — extract, match employees, stage PENDING_REVIEW.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

const {
  mockSession,
  mockUserFindUnique,
  mockEmployeeFindMany,
  mockImportCreate,
  mockExtract,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUserFindUnique: vi.fn(),
  mockEmployeeFindMany: vi.fn(),
  mockImportCreate: vi.fn(),
  mockExtract: vi.fn(),
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
vi.mock("@/lib/db", () => {
  const prisma = {
    user: { findUnique: mockUserFindUnique },
    employee: { findMany: mockEmployeeFindMany },
    timesheetImport: { create: mockImportCreate },
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

const cs = { employeeName: 0.9, date: 0.9, shiftStart: 0.9, shiftEnd: 0.9 };

describe("POST /api/timesheet/ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = MANAGER;
    mockUserFindUnique.mockResolvedValue({ workspaceId: "w1" });
  });

  it("rejects non-management users", async () => {
    mockSession.user = { ...MANAGER, role: "EMPLOYEE" } as SessionUser;
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("400s when no file is supplied", async () => {
    const res = await POST(makeRequest(false));
    expect(res.status).toBe(400);
  });

  it("stages matched employees and reports missing ones", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      { id: "e1", firstName: "Max", lastName: "Mustermann" },
    ]);
    mockExtract.mockResolvedValue({
      source: "MOCK",
      rows: [
        {
          employeeName: "Max Mustermann",
          date: "2026-06-10",
          shiftStart: "08:00",
          shiftEnd: "16:30",
          breakMinutes: 30,
          confidenceScores: cs,
        },
        {
          employeeName: "Erika Unbekannt",
          date: "2026-06-10",
          shiftStart: "09:00",
          shiftEnd: "17:00",
          breakMinutes: 45,
          confidenceScores: cs,
        },
      ],
    });
    mockImportCreate.mockResolvedValue({
      id: "imp1",
      status: "PENDING_REVIEW",
      source: "MOCK",
      entries: [
        {
          id: "ie1",
          employeeId: "e1",
          date: new Date("2026-06-10T00:00:00Z"),
          startTime: "08:00",
          endTime: "16:30",
          breakMinutes: 30,
          confidence: 0.9,
          confidenceScores: JSON.stringify(cs),
          employee: { id: "e1", firstName: "Max", lastName: "Mustermann" },
        },
      ],
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.importId).toBe("imp1");
    expect(body.entries).toHaveLength(1);
    expect(body.missingEmployees).toEqual(["Erika Unbekannt"]);
    // Only the matched employee was staged.
    expect(mockImportCreate).toHaveBeenCalledOnce();
  });

  it("500s when extraction fails", async () => {
    mockExtract.mockRejectedValue(new Error("extraction_failed"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
