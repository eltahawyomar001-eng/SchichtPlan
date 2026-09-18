/**
 * @vitest-environment node
 *
 * Drives POST /api/import with a real .xlsx buffer and asserts the rows
 * actually reach employee.createMany. Every workspace in production has
 * exactly one employee created in the same millisecond as the workspace
 * itself — i.e. the auto-created owner record — so no bulk import has ever
 * landed a row. This test exercises the whole path to find out why.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";
import ExcelJS from "exceljs";

const {
  mockSession,
  mockSubscriptionFindUnique,
  createManyCalls,
  afterCallbacks,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockSubscriptionFindUnique: vi.fn(),
  createManyCalls: [] as unknown[],
  afterCallbacks: [] as (() => Promise<void>)[],
}));

// `after()` defers work until the response is flushed; outside a real request
// context it is a no-op, so capture the callback and run it by hand.
vi.mock("next/server", async (importOriginal) => {
  const orig = await importOriginal<typeof import("next/server")>();
  return {
    ...orig,
    after: (cb: () => Promise<void>) => {
      afterCallbacks.push(cb);
    },
  };
});

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
      workspaceId: mockSession.user?.workspaceId as string,
    })),
  };
});
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: mockSubscriptionFindUnique },
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue({ createdAt: new Date() }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn((cb: any) =>
      cb({
        employee: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createMany: vi.fn(async (args: any) => {
            createManyCalls.push(args.data);
            return { count: args.data.length };
          }),
        },
      }),
    ),
  },
}));
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

import { buildAdmin } from "../helpers/factories";

async function xlsxFile(headers: string[], rows: unknown[][]): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mitarbeiter");
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], "mitarbeiter.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("POST /api/import — employees, end to end", () => {
  let handler: typeof import("@/app/api/import/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    createManyCalls.length = 0;
    afterCallbacks.length = 0;
    mockSession.user = buildAdmin();
    // A brand-new workspace on the no-card free trial: this is the state every
    // real signup is in when it reaches the import step.
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "BASIC",
      status: "TRIALING",
      stripeSubscriptionId: null,
      trialEnd: new Date(Date.now() + 7 * 864e5),
    });
    handler = await import("@/app/api/import/route");
  });

  it("imports German-header rows on a TRIALING workspace", async () => {
    const file = await xlsxFile(
      [
        "vorname",
        "nachname",
        "email",
        "telefon",
        "position",
        "stundenlohn",
        "wochenstunden",
      ],
      [
        [
          "Lukas",
          "Bergmann",
          "lukas.bergmann@musterbau.de",
          "+49 661 2841701",
          "Vorarbeiter",
          24.5,
          40,
        ],
        [
          "Sofia",
          "Keller",
          "sofia.keller@musterbau.de",
          "+49 661 2841702",
          "Elektrikerin",
          23,
          40,
        ],
      ],
    );
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "employees");

    const res = await handler.POST(
      new Request("http://localhost/api/import", { method: "POST", body: fd }),
    );
    expect(res.status).toBe(202);

    for (const cb of afterCallbacks) await cb();

    const created = createManyCalls.flat() as { email: string }[];
    expect(created).toHaveLength(2);
    expect(created.map((e) => e.email)).toEqual([
      "lukas.bergmann@musterbau.de",
      "sofia.keller@musterbau.de",
    ]);
  });

  it("imports the spaced English headers the upload hint tells users to type", async () => {
    const file = await xlsxFile(
      [
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Position",
        "Hourly Rate",
        "Weekly Hours",
      ],
      [
        [
          "Lukas",
          "Bergmann",
          "lukas.bergmann@musterbau.de",
          "+49 661 2841701",
          "Vorarbeiter",
          24.5,
          40,
        ],
      ],
    );
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "employees");

    const res = await handler.POST(
      new Request("http://localhost/api/import", { method: "POST", body: fd }),
    );
    expect(res.status).toBe(202);
    for (const cb of afterCallbacks) await cb();

    // Before the normalizeHeader fix this was 0 — every row "Fehlender Name".
    expect(createManyCalls.flat()).toHaveLength(1);
  });
});
