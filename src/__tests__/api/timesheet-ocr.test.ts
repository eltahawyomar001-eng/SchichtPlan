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

const cs = { date: 0.9, shiftStart: 0.9, shiftEnd: 0.9 };
const ROW = {
  employeeName: null,
  date: "2026-06-10",
  shiftStart: "08:00",
  shiftEnd: "16:30",
  breakMinutes: 30,
  confidenceScores: cs,
};
const STAGED_ENTRY = {
  id: "ie1",
  employeeId: "e1",
  date: new Date("2026-06-10T00:00:00Z"),
  startTime: "08:00",
  endTime: "16:30",
  breakMinutes: 30,
  confidence: 0.9,
  confidenceScores: JSON.stringify(cs),
  employee: { id: "e1", firstName: "Max", lastName: "Mustermann" },
};

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

  it("matches the header employee by NAME and stages nameless rows", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e1",
        firstName: "Max",
        lastName: "Mustermann",
        datevPersonnelNumber: null,
      },
    ]);
    // Common single-employee sheet: name in header, rows carry no name.
    mockExtract.mockResolvedValue({
      source: "MOCK",
      employee: {
        name: "Max Mustermann",
        personnelNumber: null,
        confidence: 0.95,
      },
      rows: [ROW, { ...ROW, date: "2026-06-11" }],
    });
    mockImportCreate.mockResolvedValue({
      id: "imp1",
      status: "PENDING_REVIEW",
      source: "MOCK",
      entries: [STAGED_ENTRY],
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.importId).toBe("imp1");
    expect(body.entries).toHaveLength(1);
    expect(body.missingEmployees).toEqual([]);
    // Both nameless rows resolved to the header employee → staged together.
    const created = mockImportCreate.mock.calls[0][0];
    expect(created.data.entries.create).toHaveLength(2);
  });

  it("matches the header employee by PERSONAL-NR even when the name differs", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e1",
        firstName: "Max",
        lastName: "Mustermann",
        datevPersonnelNumber: "123456",
      },
    ]);
    mockExtract.mockResolvedValue({
      source: "MOCK",
      // Name misread, but the personnel number is unambiguous.
      employee: {
        name: "Maxx Mustermn",
        personnelNumber: "123456",
        confidence: 0.6,
      },
      rows: [ROW],
    });
    mockImportCreate.mockResolvedValue({
      id: "imp2",
      status: "PENDING_REVIEW",
      source: "MOCK",
      entries: [STAGED_ENTRY],
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.missingEmployees).toEqual([]);
    expect(mockImportCreate.mock.calls[0][0].data.entries.create).toHaveLength(
      1,
    );
  });

  it("blocks an unknown header employee and reports them for invite", async () => {
    mockEmployeeFindMany.mockResolvedValue([
      {
        id: "e1",
        firstName: "Max",
        lastName: "Mustermann",
        datevPersonnelNumber: null,
      },
    ]);
    mockExtract.mockResolvedValue({
      source: "MOCK",
      employee: {
        name: "Erika Unbekannt",
        personnelNumber: null,
        confidence: 0.9,
      },
      rows: [ROW],
    });
    mockImportCreate.mockResolvedValue({
      id: "imp3",
      status: "PENDING_REVIEW",
      source: "MOCK",
      entries: [],
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entries).toHaveLength(0);
    expect(body.missingEmployees).toEqual(["Erika Unbekannt"]);
    // No rows matched → none staged.
    expect(mockImportCreate.mock.calls[0][0].data.entries.create).toHaveLength(
      0,
    );
  });

  it("500s when extraction fails", async () => {
    mockExtract.mockRejectedValue(new Error("extraction_failed"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
