/**
 * @vitest-environment node
 *
 * AI Timesheet Scanner — entitlement gating + monthly scan quota.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSubFindUnique, mockUsageUpsert, mockUsageUpdate, mockCache } =
  vi.hoisted(() => ({
    mockSubFindUnique: vi.fn(),
    mockUsageUpsert: vi.fn(),
    mockUsageUpdate: vi.fn(),
    mockCache: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    },
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: mockSubFindUnique },
    workspaceUsage: { upsert: mockUsageUpsert, update: mockUsageUpdate },
  },
}));
vi.mock("@/lib/cache", () => ({ cache: mockCache }));

import {
  hasTimesheetScannerAddon,
  isTimesheetScannerPriceId,
  invalidateTimesheetScannerAddonCache,
  FREE_SCANS_PER_MONTH,
  PREMIUM_SCANS_PER_MONTH,
  getTimesheetScannerStripePriceId,
} from "@/lib/timesheet-scanner-addon";
import {
  getScanQuota,
  consumeScan,
  startOfNextMonthUTC,
  quotaExceededPayload,
} from "@/lib/timesheet-scanner-quota";

beforeEach(() => {
  vi.clearAllMocks();
  mockCache.get.mockResolvedValue(null); // default: cache miss
  mockCache.set.mockResolvedValue(undefined);
  mockCache.del.mockResolvedValue(undefined);
  delete process.env.STRIPE_PRICE_TIMESHEET_SCANNER_MONTHLY;
});

describe("hasTimesheetScannerAddon", () => {
  it("returns true when active subscription has the add-on flag", async () => {
    mockSubFindUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "BASIC",
      timesheetScannerAddonActive: true,
    });
    expect(await hasTimesheetScannerAddon("w1")).toBe(true);
    expect(mockCache.set).toHaveBeenCalledWith(
      "addon:timesheet-scanner:w1",
      true,
      expect.any(Number),
    );
  });

  it("returns true for Enterprise even without the flag", async () => {
    mockSubFindUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "ENTERPRISE",
      timesheetScannerAddonActive: false,
    });
    expect(await hasTimesheetScannerAddon("w1")).toBe(true);
  });

  it("returns false when the flag is off (non-enterprise)", async () => {
    mockSubFindUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "PROFESSIONAL",
      timesheetScannerAddonActive: false,
    });
    expect(await hasTimesheetScannerAddon("w1")).toBe(false);
  });

  it("returns false when the subscription is not active", async () => {
    mockSubFindUnique.mockResolvedValue({
      status: "CANCELED",
      plan: "BASIC",
      timesheetScannerAddonActive: true,
    });
    expect(await hasTimesheetScannerAddon("w1")).toBe(false);
  });

  it("returns false when there is no subscription", async () => {
    mockSubFindUnique.mockResolvedValue(null);
    expect(await hasTimesheetScannerAddon("w1")).toBe(false);
  });

  it("short-circuits on a cache hit without querying the DB", async () => {
    mockCache.get.mockResolvedValue(true);
    expect(await hasTimesheetScannerAddon("w1")).toBe(true);
    expect(mockSubFindUnique).not.toHaveBeenCalled();
  });
});

describe("price helpers", () => {
  it("matches the configured price id", () => {
    process.env.STRIPE_PRICE_TIMESHEET_SCANNER_MONTHLY = "price_abc";
    expect(getTimesheetScannerStripePriceId()).toBe("price_abc");
    expect(isTimesheetScannerPriceId("price_abc")).toBe(true);
    expect(isTimesheetScannerPriceId("price_other")).toBe(false);
  });

  it("never matches when no price is configured", () => {
    expect(isTimesheetScannerPriceId("price_abc")).toBe(false);
  });
});

describe("invalidateTimesheetScannerAddonCache", () => {
  it("drops the cache key", async () => {
    await invalidateTimesheetScannerAddonCache("w1");
    expect(mockCache.del).toHaveBeenCalledWith("addon:timesheet-scanner:w1");
  });
});

describe("startOfNextMonthUTC", () => {
  it("returns the first instant of the next month (UTC)", () => {
    const d = new Date("2026-06-13T12:34:56.000Z");
    expect(startOfNextMonthUTC(d).toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("rolls over the year in December", () => {
    const d = new Date("2026-12-20T00:00:00.000Z");
    expect(startOfNextMonthUTC(d).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});

describe("getScanQuota", () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it("reports the free tier cap for non-premium workspaces", async () => {
    mockSubFindUnique.mockResolvedValue(null); // no add-on
    mockUsageUpsert.mockResolvedValue({
      scansThisMonth: 5,
      scansResetAt: future,
    });

    const q = await getScanQuota("w1");
    expect(q.tier).toBe("free");
    expect(q.limit).toBe(FREE_SCANS_PER_MONTH);
    expect(q.used).toBe(5);
    expect(q.remaining).toBe(FREE_SCANS_PER_MONTH - 5);
    expect(q.blocked).toBe(false);
  });

  it("reports the premium cap when the add-on is active", async () => {
    mockSubFindUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "BASIC",
      timesheetScannerAddonActive: true,
    });
    mockUsageUpsert.mockResolvedValue({
      scansThisMonth: 0,
      scansResetAt: future,
    });

    const q = await getScanQuota("w1");
    expect(q.tier).toBe("premium");
    expect(q.limit).toBe(PREMIUM_SCANS_PER_MONTH);
  });

  it("blocks once the cap is reached", async () => {
    mockSubFindUnique.mockResolvedValue(null);
    mockUsageUpsert.mockResolvedValue({
      scansThisMonth: FREE_SCANS_PER_MONTH,
      scansResetAt: future,
    });

    const q = await getScanQuota("w1");
    expect(q.remaining).toBe(0);
    expect(q.blocked).toBe(true);
  });

  it("resets the counter when the billing month has rolled over", async () => {
    mockSubFindUnique.mockResolvedValue(null);
    mockUsageUpsert.mockResolvedValue({
      scansThisMonth: 25,
      scansResetAt: past,
    });
    mockUsageUpdate.mockResolvedValue({});

    const q = await getScanQuota("w1");
    expect(q.used).toBe(0);
    expect(q.blocked).toBe(false);
    expect(mockUsageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "w1" },
        data: expect.objectContaining({ scansThisMonth: 0 }),
      }),
    );
  });
});

describe("consumeScan", () => {
  it("increments the monthly counter by one", async () => {
    mockUsageUpdate.mockResolvedValue({});
    await consumeScan("w1");
    expect(mockUsageUpdate).toHaveBeenCalledWith({
      where: { workspaceId: "w1" },
      data: { scansThisMonth: { increment: 1 } },
    });
  });
});

describe("quotaExceededPayload", () => {
  const base = {
    limit: 30,
    used: 30,
    remaining: 0,
    resetAt: new Date("2026-07-01T00:00:00.000Z"),
    blocked: true,
  };

  it("flags an upsell for the free tier", () => {
    const p = quotaExceededPayload({ ...base, tier: "free" });
    expect(p.error).toBe("SCAN_QUOTA_EXCEEDED");
    expect(p.upgradeRequired).toBe(true);
    expect(p.contactSupport).toBe(false);
  });

  it("flags fair-use/contact-support for the premium tier", () => {
    const p = quotaExceededPayload({ ...base, tier: "premium", limit: 600 });
    expect(p.upgradeRequired).toBe(false);
    expect(p.contactSupport).toBe(true);
  });
});
