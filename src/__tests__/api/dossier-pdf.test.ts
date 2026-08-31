/**
 * @vitest-environment node
 *
 * FKS dossier PDF export.
 *
 * This is the artifact handed to a Zoll auditor, so the test actually renders
 * it rather than asserting on call counts: jsPDF/autoTable failures (a bad
 * columnStyles font, a colSpan cell, a spread into setTextColor) only surface
 * at render time, and a route that 500s during an unannounced audit is the
 * worst possible moment to find out.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSession: { user: Record<string, unknown> | null } = {
  user: {
    id: "u-1",
    email: "chef@example.de",
    role: "OWNER",
    workspaceId: "ws-1",
  },
};

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async () => ({
      ok: true,
      user: mockSession.user,
      workspaceId: "ws-1",
    })),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/lib/authorization", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/authorization")>();
  return { ...orig, requirePermission: vi.fn(() => null) };
});

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/logger", () => {
  const base = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  // withRoute wraps every handler and asks the logger for a request-scoped
  // child, so the mock has to provide one.
  return { log: { ...base, withRequestId: vi.fn(() => base) } };
});

const db = vi.hoisted(() => ({
  dossierFindFirst: vi.fn(),
  workspaceFindUnique: vi.fn(),
  timeEntryFindMany: vi.fn(),
  importFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  overrideFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditDossier: { findFirst: db.dossierFindFirst },
    workspace: { findUnique: db.workspaceFindUnique },
    timeEntry: { findMany: db.timeEntryFindMany },
    timesheetImport: { findMany: db.importFindMany },
    employee: { findMany: db.employeeFindMany },
    complianceOverride: { findMany: db.overrideFindMany },
    user: { findMany: db.userFindMany },
  },
}));

const HASH = "a".repeat(64);

function makeCtx() {
  return { params: Promise.resolve({ id: "dos-1" }) };
}

beforeEach(() => {
  vi.clearAllMocks();

  db.dossierFindFirst.mockResolvedValue({
    id: "dos-1",
    workspaceId: "ws-1",
    periodStart: new Date("2026-08-01"),
    periodEnd: new Date("2026-08-31"),
    readinessScore: 82,
    passCount: 40,
    warnCount: 3,
    failCount: 2,
    contentHash: HASH,
    generatedAt: new Date("2026-09-01T09:00:00Z"),
    snapshot: {
      employeeSummaries: [{ name: "Lara Jennings", netMinutes: 9600 }],
    },
  });

  db.workspaceFindUnique.mockResolvedValue({
    name: "Axiom24 Facility Management",
    betriebsnummer: "12345678",
    minHourlyWageCents: 1390,
    securitySectorMode: true,
  });

  db.timeEntryFindMany.mockResolvedValue([
    {
      date: new Date("2026-08-03"),
      startTime: "08:00",
      endTime: "16:30",
      netMinutes: 480,
      breakMinutes: 30,
      status: "BESTAETIGT",
      checkInDistanceM: 12.4,
      checkInAccuracyM: 8,
      geofenceStatus: "INSIDE",
      locationMocked: false,
      geofenceOverrideReason: null,
      employee: { firstName: "Lara", lastName: "Jennings" },
      location: { name: "Objekt Nord", geofenceRadiusMeters: 50 },
    },
    {
      date: new Date("2026-08-04"),
      startTime: "22:00",
      endTime: "06:00",
      netMinutes: 450,
      breakMinutes: 30,
      status: "EINGEREICHT",
      checkInDistanceM: 812,
      checkInAccuracyM: 15,
      geofenceStatus: "OUTSIDE",
      locationMocked: true,
      geofenceOverrideReason: "Zufahrt gesperrt",
      employee: { firstName: "Moumen", lastName: "Alsaker" },
      location: { name: "Objekt Süd", geofenceRadiusMeters: 50 },
    },
  ]);

  db.importFindMany.mockResolvedValue([
    {
      id: "imp-1",
      status: "APPROVED",
      source: "PHOTO",
      documentRef: "b".repeat(64),
      importedAt: new Date("2026-08-10T10:00:00Z"),
      reviewedAt: new Date("2026-08-10T11:00:00Z"),
      importedBy: { name: "Chef", email: "chef@example.de" },
      _count: { entries: 12 },
    },
  ]);

  db.employeeFindMany.mockResolvedValue([
    {
      firstName: "Lara",
      lastName: "Jennings",
      hourlyRate: 15.5,
      bewacherId: "BW-0001",
      bewacherRegisterStatus: "GEPRUEFT",
      bewacherValidatedAt: new Date("2026-01-15"),
      reliabilityCheckedAt: new Date("2026-01-10"),
      employeeSkills: [
        {
          expiresAt: new Date("2027-01-01"),
          certificateNumber: "SK-9",
          skill: { name: "§34a Sachkunde" },
        },
      ],
    },
    {
      // Wage below MiLoG, no register entry, expired certificate — the row
      // that must render in red.
      firstName: "Moumen",
      lastName: "Alsaker",
      hourlyRate: 11.0,
      bewacherId: null,
      bewacherRegisterStatus: null,
      bewacherValidatedAt: null,
      reliabilityCheckedAt: null,
      employeeSkills: [
        {
          expiresAt: new Date("2025-01-01"),
          certificateNumber: null,
          skill: { name: "§34a Unterrichtung" },
        },
      ],
    },
  ]);

  db.overrideFindMany.mockResolvedValue([
    {
      id: "ov-1",
      rule: "SACHKUNDE_34A",
      entityType: "Shift",
      entityId: "shift-abcdef123",
      reason: "Nachweis liegt in Papierform vor, Registereintrag beantragt.",
      overriddenAt: new Date("2026-08-12T08:30:00Z"),
      overriddenBy: "u-1",
      workspaceId: "ws-1",
    },
  ]);

  db.userFindMany.mockResolvedValue([
    { id: "u-1", name: "Omar Rageh", email: "chef@example.de" },
  ]);
});

describe("GET /api/compliance/dossier/[id]/pdf", () => {
  it("renders a real PDF with the expected headers", async () => {
    const { GET } = await import("@/app/api/compliance/dossier/[id]/pdf/route");
    const res = await GET(
      new Request("http://localhost/api/compliance/dossier/dos-1/pdf"),
      makeCtx() as never,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      "FKS-Pruefdossier",
    );

    const buf = Buffer.from(await res.arrayBuffer());
    // A valid PDF starts with %PDF- and ends with the EOF marker.
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.subarray(-1024).toString("latin1")).toContain("%%EOF");
    // Multi-section dossier: comfortably more than an empty page.
    expect(buf.length).toBeGreaterThan(5000);
  });

  it("renders even when every optional dataset is empty", async () => {
    // The realistic first-run state: a workspace that has not enabled
    // geofencing, never used OCR import, and overridden nothing. It must not
    // produce a broken document.
    db.timeEntryFindMany.mockResolvedValue([]);
    db.importFindMany.mockResolvedValue([]);
    db.overrideFindMany.mockResolvedValue([]);
    db.employeeFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/compliance/dossier/[id]/pdf/route");
    const res = await GET(
      new Request("http://localhost/api/compliance/dossier/dos-1/pdf"),
      makeCtx() as never,
    );

    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("404s for a dossier belonging to another workspace", async () => {
    db.dossierFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/compliance/dossier/[id]/pdf/route");
    const res = await GET(
      new Request("http://localhost/api/compliance/dossier/dos-1/pdf"),
      makeCtx() as never,
    );
    expect(res.status).toBe(404);
  });
});
