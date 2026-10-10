/**
 * What a colleague is allowed to read about another employee.
 *
 * The Employee row carries regulated personal data. The route previously
 * omitted two fields and returned the rest, so Sozialversicherungsnummer,
 * date and place of birth and nationality were served to any authenticated
 * user in the workspace.
 *
 * These tests assert on the RAW HTTP RESPONSE rather than on the Prisma
 * arguments. Checking the select would only prove the select was written as
 * intended; it would not catch a field reintroduced by a later `include`, a
 * spread, or a nested relation. The response is what actually reaches a user.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";
import { EMPLOYEE_SENSITIVE_FIELDS } from "@/lib/employee-projection";

const { mockSession, mockFindMany, mockCount } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
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
vi.mock("@/lib/db", () => {
  const prisma = {
    employee: { findMany: mockFindMany, count: mockCount },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return {
    prisma,
    withWorkspaceContext: (_w: string, fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
  };
});
vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async () => {
      if (!mockSession.user) {
        const { NextResponse } = await import("next/server");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          ),
        };
      }
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId,
      };
    }),
  };
});
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    // withRoute builds a request-scoped logger on every call.
    withRequestId: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const employee = (over: Partial<SessionUser> = {}): SessionUser =>
  ({
    id: "u1",
    email: "kollege@example.test",
    role: "EMPLOYEE",
    workspaceId: "ws1",
    employeeId: "e1",
    ...over,
  }) as SessionUser;

const manager = () => employee({ id: "u2", role: "ADMIN", employeeId: "e2" });

/**
 * A row as the database would hand it back under the MANAGEMENT select.
 * The mock returns everything; the route decides what to send, which is what
 * is under test.
 */
const fullRow = {
  id: "e9",
  firstName: "Erika",
  lastName: "Musterfrau",
  position: "Sicherheitskraft",
  color: "#059669",
  isActive: true,
  locationId: "loc1",
  email: "erika@example.test",
  phone: "+49 170 0000000",
  hourlyRate: 15.5,
  contractType: "VOLLZEIT",
  dateOfBirth: new Date("1990-01-01"),
  socialSecurityNumber: "12 345678 M 901",
  birthPlace: "Fulda",
  nationality: "DE",
  datevPersonnelNumber: "4711",
  bewacherId: "BW-123",
  bewacherRegisterStatus: "VALID",
  pinHash: "$2b$10$notarealhash",
};

/**
 * Apply `select` the way Prisma would.
 *
 * Without this the mock returns every column whatever the route asked for, and
 * a response-level assertion proves nothing -- it would fail even for a
 * correct route, and pass for a broken one if the fixture happened to omit the
 * field. Simulating the narrowing makes the test ask the real question: given
 * a database that honours the select, does anything sensitive still reach the
 * caller through a spread, an include, or a later mapping?
 */
function applySelect(
  row: Record<string, unknown>,
  select?: Record<string, unknown>,
) {
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const [key, want] of Object.entries(select)) {
    if (want && key in row) out[key] = row[key];
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCount.mockResolvedValue(1);
  mockFindMany.mockImplementation(
    async (args: { select?: Record<string, unknown> }) => [
      applySelect(fullRow, args?.select),
    ],
  );
});

async function get() {
  const { GET } = await import("@/app/api/employees/route");
  return GET(new Request("http://localhost/api/employees"));
}

describe("a colleague (EMPLOYEE role)", () => {
  beforeEach(() => {
    mockSession.user = employee();
  });

  it("never receives regulated personal data", async () => {
    const body = await (await get()).json();
    const row = body.data[0];
    for (const field of EMPLOYEE_SENSITIVE_FIELDS) {
      expect(
        Object.prototype.hasOwnProperty.call(row, field),
        `colleague response must not contain ${field}`,
      ).toBe(false);
    }
  });

  it("never receives a Sozialversicherungsnummer, stated separately", async () => {
    // Called out on its own because it is the field whose disclosure would be
    // most damaging, and the one the previous denylist actually leaked.
    const raw = JSON.stringify(await (await get()).json());
    expect(raw).not.toContain("12 345678 M 901");
    expect(raw).not.toContain("socialSecurityNumber");
  });

  it("asks the database for a narrowed set of columns", async () => {
    // Minimisation has to happen in the query: reading the row and discarding
    // fields afterwards still reads it, which Art. 5(1)(c) is about.
    await get();
    const args = mockFindMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.socialSecurityNumber).toBeUndefined();
    expect(args.select.hourlyRate).toBeUndefined();
    expect(args.select.pinHash).toBeUndefined();
  });

  it("still receives what a directory needs", async () => {
    const row = (await (await get()).json()).data[0];
    expect(row).toMatchObject({
      id: "e9",
      firstName: "Erika",
      lastName: "Musterfrau",
      position: "Sicherheitskraft",
      isActive: true,
    });
  });
});

describe("a manager (ADMIN role)", () => {
  beforeEach(() => {
    mockSession.user = manager();
  });

  it("still receives the personnel fields it administers", async () => {
    // Narrowing must not break the HR screen, which edits these.
    const row = (await (await get()).json()).data[0];
    expect(row.socialSecurityNumber).toBe("12 345678 M 901");
    expect(row.hourlyRate).toBe(15.5);
    expect(row.dateOfBirth).toBeDefined();
  });

  it("never receives the PIN hash", async () => {
    // A credential, not personnel data. No role may read it.
    const row = (await (await get()).json()).data[0];
    expect(row.pinHash).toBeUndefined();
    expect(row.hasPin).toBe(true);
  });
});

describe("an unauthenticated caller", () => {
  it("gets nothing", async () => {
    mockSession.user = null;
    expect((await get()).status).toBe(401);
  });
});

/**
 * The same leak, nested inside other records.
 *
 * Narrowing the employees list is not enough while a shift, report or absence
 * row carries the whole employee. The schedule is the most-loaded screen in
 * the product, so `include: { employee: true }` there put every colleague's
 * regulated data in front of every employee who opened it.
 */
describe("the nested projection", () => {
  it("carries only display fields", async () => {
    const { EMPLOYEE_NESTED_SELECT } =
      await import("@/lib/employee-projection");
    expect(Object.keys(EMPLOYEE_NESTED_SELECT).sort()).toEqual(
      ["color", "firstName", "id", "lastName", "position"].sort(),
    );
  });

  it("excludes every regulated field", async () => {
    const { EMPLOYEE_NESTED_SELECT, EMPLOYEE_SENSITIVE_FIELDS } =
      await import("@/lib/employee-projection");
    for (const field of EMPLOYEE_SENSITIVE_FIELDS) {
      expect(
        (EMPLOYEE_NESTED_SELECT as Record<string, unknown>)[field],
        `nested projection must not select ${field}`,
      ).toBeUndefined();
    }
  });
});
