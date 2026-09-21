/**
 * @vitest-environment node
 *
 * The limit CHECK and the limit MESSAGE must read the same number.
 *
 * Regression: canAddLocation/canAddEmployee read the raw plan entry while
 * requireLocationSlot/requireEmployeeSlot built their message from the
 * trial-adjusted plan. On a free trial that meant a workspace holding one
 * location was refused a second — and told "you have reached the maximum of 3
 * locations". Blocked at the Basic ceiling, informed of the trial one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSubFindUnique, mockLocationCount, mockEmployeeCount } = vi.hoisted(
  () => ({
    mockSubFindUnique: vi.fn(),
    mockLocationCount: vi.fn(),
    mockEmployeeCount: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: mockSubFindUnique },
    location: { count: mockLocationCount },
    employee: { count: mockEmployeeCount },
  },
}));
vi.mock("@/lib/cache", () => ({
  cache: { get: vi.fn(async () => null), set: vi.fn(), del: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A workspace on the no-card free trial: TRIALING with no Stripe sub. */
const TRIAL_SUB = {
  plan: "BASIC",
  status: "TRIALING",
  stripeSubscriptionId: null,
  trialEnd: new Date(Date.now() + 7 * 864e5),
};

describe("plan limits during a free trial", () => {
  let lib: typeof import("@/lib/subscription");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSubFindUnique.mockResolvedValue(TRIAL_SUB);
    lib = await import("@/lib/subscription");
  });

  it("allows a second location on a trial, where Basic alone would not", async () => {
    // Basic permits 1 location; the trial override permits 3.
    mockLocationCount.mockResolvedValue(1);
    await expect(lib.canAddLocation("ws-1")).resolves.toBe(true);
  });

  it("stops at the trial ceiling, not before it", async () => {
    mockLocationCount.mockResolvedValue(3);
    await expect(lib.canAddLocation("ws-1")).resolves.toBe(false);
  });

  it("lets a brand-new workspace create its first location", async () => {
    mockLocationCount.mockResolvedValue(0);
    await expect(lib.canAddLocation("ws-1")).resolves.toBe(true);
  });

  it("quotes the same ceiling it enforces for locations", async () => {
    mockLocationCount.mockResolvedValue(3);
    const res = await lib.requireLocationSlot("ws-1");
    expect(res).not.toBeNull();
    const body = await res!.json();
    // The number in the message is the number that actually blocked them.
    expect(body.limit).toBe(3);
    expect(mockLocationCount).toHaveBeenCalled();
  });

  it("applies the trial ceiling to employees too", async () => {
    // Basic permits 15; the trial override permits 25.
    mockEmployeeCount.mockResolvedValue(20);
    await expect(lib.canAddEmployee("ws-1")).resolves.toBe(true);

    mockEmployeeCount.mockResolvedValue(25);
    await expect(lib.canAddEmployee("ws-1")).resolves.toBe(false);
  });

  it("quotes the same ceiling it enforces for employees", async () => {
    mockEmployeeCount.mockResolvedValue(25);
    const res = await lib.requireEmployeeSlot("ws-1");
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.limit).toBe(25);
  });

  it("gives the slot back when a location is deleted", async () => {
    // The count included every row ever created, so deleting never freed the
    // slot: a workspace holding NO locations was told it had reached the
    // maximum and had to upgrade to create its first one. Paying to replace
    // something it had already removed.
    mockLocationCount.mockResolvedValue(0);
    await expect(lib.canAddLocation("ws-1")).resolves.toBe(true);

    const where = mockLocationCount.mock.calls[0][0].where;
    expect(where).toMatchObject({ workspaceId: "ws-1", deletedAt: null });
  });

  it("does not count deleted employees against the seat limit", async () => {
    mockEmployeeCount.mockResolvedValue(0);
    await expect(lib.canAddEmployee("ws-1")).resolves.toBe(true);

    const where = mockEmployeeCount.mock.calls[0][0].where;
    expect(where).toMatchObject({ deletedAt: null });
  });

  it("refuses everything without an active subscription", async () => {
    mockSubFindUnique.mockResolvedValue({ ...TRIAL_SUB, status: "CANCELED" });
    mockLocationCount.mockResolvedValue(0);
    await expect(lib.canAddLocation("ws-1")).resolves.toBe(false);
    await expect(lib.canAddEmployee("ws-1")).resolves.toBe(false);
  });
});
