/**
 * @vitest-environment node
 *
 * Sick leave waits for a manager, unless a workspace has opted in.
 *
 * It used to approve itself within a second of submission, which reads as an
 * approval flow that does not work -- and leaves the manager who has to cover
 * the shift never told that anyone is out. The legal argument for auto-approval
 * is sound as far as it goes (§5 EFZG obliges an employee to REPORT illness,
 * not to ask permission), but "the employer cannot refuse" is not the same as
 * "no human needs to see this".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAbsenceFindUnique,
  mockAbsenceUpdate,
  mockSettingFindUnique,
  mockCascade,
} = vi.hoisted(() => ({
  mockAbsenceFindUnique: vi.fn(),
  mockAbsenceUpdate: vi.fn(),
  mockSettingFindUnique: vi.fn(),
  mockCascade: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    absenceRequest: {
      findUnique: mockAbsenceFindUnique,
      update: mockAbsenceUpdate,
    },
    automationSetting: { findUnique: mockSettingFindUnique },
    // Approving cascades into the roster to free the shifts; none of these
    // tests care about that, they care about whether approval happens at all.
    shift: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PENDING_SICK = {
  id: "a1",
  status: "AUSSTEHEND",
  category: "KRANK",
  workspaceId: "ws-1",
  employeeId: "e1",
  startDate: new Date("2026-09-25"),
  endDate: new Date("2026-09-27"),
  employee: { firstName: "Omar", lastName: "Rageh", email: "o@example.com" },
};

describe("tryAutoApproveAbsence", () => {
  let lib: typeof import("@/lib/automations");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAbsenceUpdate.mockResolvedValue({});
    mockCascade.mockResolvedValue(undefined);
    // No explicit row: every workspace runs on the default.
    mockSettingFindUnique.mockResolvedValue(null);
    lib = await import("@/lib/automations");
  });

  it("leaves sick leave pending when the workspace has not opted in", async () => {
    mockAbsenceFindUnique.mockResolvedValue(PENDING_SICK);

    await expect(lib.tryAutoApproveAbsence("a1")).resolves.toBe(false);
    expect(mockAbsenceUpdate).not.toHaveBeenCalled();
  });

  it("approves sick leave only where the workspace opted in", async () => {
    mockAbsenceFindUnique.mockResolvedValue(PENDING_SICK);
    mockSettingFindUnique.mockResolvedValue({ enabled: true });

    await expect(lib.tryAutoApproveAbsence("a1")).resolves.toBe(true);
    expect(mockAbsenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "GENEHMIGT" }),
      }),
    );
  });

  it("never approves vacation, even for a workspace that opted in", async () => {
    // §7 BUrlG gives the employer the right to weigh operational needs, so
    // this one genuinely is a request and not a notification.
    mockAbsenceFindUnique.mockResolvedValue({
      ...PENDING_SICK,
      category: "URLAUB",
    });
    mockSettingFindUnique.mockResolvedValue({ enabled: true });

    await expect(lib.tryAutoApproveAbsence("a1")).resolves.toBe(false);
    expect(mockAbsenceUpdate).not.toHaveBeenCalled();
  });

  it("does not touch a request that has already been decided", async () => {
    mockAbsenceFindUnique.mockResolvedValue({
      ...PENDING_SICK,
      status: "ABGELEHNT",
    });
    mockSettingFindUnique.mockResolvedValue({ enabled: true });

    await expect(lib.tryAutoApproveAbsence("a1")).resolves.toBe(false);
    expect(mockAbsenceUpdate).not.toHaveBeenCalled();
  });
});
