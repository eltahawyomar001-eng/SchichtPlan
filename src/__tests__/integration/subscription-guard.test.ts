/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mock Prisma + dependencies before importing the module ── */
const {
  mockUsageFindUnique,
  mockUsageCreate,
  mockUsageUpdate,
  mockUsageUpsert,
  mockEmployeeCount,
  mockInvitationCount,
  mockSubscriptionFindUnique,
  mockSubscriptionFindFirst,
} = vi.hoisted(() => ({
  mockUsageFindUnique: vi.fn(),
  mockUsageCreate: vi.fn(),
  mockUsageUpdate: vi.fn(),
  mockUsageUpsert: vi.fn(),
  mockEmployeeCount: vi.fn(),
  mockInvitationCount: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceUsage: {
      findUnique: mockUsageFindUnique,
      create: mockUsageCreate,
      update: mockUsageUpdate,
      upsert: mockUsageUpsert,
    },
    employee: { count: mockEmployeeCount },
    invitation: { count: mockInvitationCount },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      findFirst: mockSubscriptionFindFirst,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  ensureWorkspaceUsage,
  syncUsageLimits,
  countOccupiedSlots,
  checkUserSlot,
  requireUserSlot,
  checkPdfQuota,
  requirePdfQuota,
  recordPdfGeneration,
  checkStorageQuota,
  requireStorageQuota,
  recordStorageUsage,
  compressSignature,
} from "@/lib/subscription-guard";

/* ── Helpers ── */

const WS_ID = "ws-test-123";

function buildUsageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "usage-1",
    workspaceId: WS_ID,
    userSlotsTotal: 10,
    pdfsGeneratedThisMonth: 0,
    pdfsMonthlyLimit: 50,
    pdfsResetAt: new Date(),
    storageBytesUsed: BigInt(0),
    storageBytesLimit: BigInt(524288000), // 500 MB
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Subscription Guard — integration tests
   ═══════════════════════════════════════════════════════════════ */

describe("subscription-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── ensureWorkspaceUsage ──────────────────────────────────

  describe("ensureWorkspaceUsage", () => {
    it("returns existing usage row if present", async () => {
      const existing = buildUsageRow();
      mockUsageFindUnique.mockResolvedValue(existing);

      const result = await ensureWorkspaceUsage(WS_ID);
      expect(result).toBe(existing);
      expect(mockUsageCreate).not.toHaveBeenCalled();
    });

    it("creates usage row from plan defaults when missing", async () => {
      mockUsageFindUnique.mockResolvedValue(null);
      // getWorkspacePlan will read subscription
      mockSubscriptionFindUnique.mockResolvedValue(null); // basic plan
      const created = buildUsageRow();
      mockUsageCreate.mockResolvedValue(created);

      const result = await ensureWorkspaceUsage(WS_ID);
      expect(result).toEqual(created);
      expect(mockUsageCreate).toHaveBeenCalledOnce();
    });
  });

  // ─── syncUsageLimits ──────────────────────────────────────

  describe("syncUsageLimits", () => {
    it("upserts usage limits for basic plan", async () => {
      mockUsageUpsert.mockResolvedValue(buildUsageRow());
      await syncUsageLimits(WS_ID, "basic");
      expect(mockUsageUpsert).toHaveBeenCalledOnce();
      const call = mockUsageUpsert.mock.calls[0][0];
      expect(call.where.workspaceId).toBe(WS_ID);
      expect(call.update.pdfsMonthlyLimit).toBe(50);
    });

    it("upserts usage limits for professional plan", async () => {
      mockUsageUpsert.mockResolvedValue(buildUsageRow());
      await syncUsageLimits(WS_ID, "professional");
      const call = mockUsageUpsert.mock.calls[0][0];
      expect(call.update.pdfsMonthlyLimit).toBe(500);
    });

    it("upserts usage limits for enterprise plan with high caps", async () => {
      mockUsageUpsert.mockResolvedValue(buildUsageRow());
      await syncUsageLimits(WS_ID, "enterprise");
      const call = mockUsageUpsert.mock.calls[0][0];
      // Infinity becomes 999999
      expect(call.update.pdfsMonthlyLimit).toBe(999999);
      expect(call.update.userSlotsTotal).toBe(999999);
    });
  });

  // ─── countOccupiedSlots ───────────────────────────────────

  describe("countOccupiedSlots", () => {
    it("returns sum of active employees and pending invitations", async () => {
      mockEmployeeCount.mockResolvedValue(5);
      mockInvitationCount.mockResolvedValue(3);

      const count = await countOccupiedSlots(WS_ID);
      expect(count).toBe(8);
    });

    it("returns 0 when no employees or invitations", async () => {
      mockEmployeeCount.mockResolvedValue(0);
      mockInvitationCount.mockResolvedValue(0);

      const count = await countOccupiedSlots(WS_ID);
      expect(count).toBe(0);
    });
  });

  // ─── User Slot Guards ─────────────────────────────────────

  describe("checkUserSlot", () => {
    it("allows when under limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ userSlotsTotal: 10 }),
      );
      mockEmployeeCount.mockResolvedValue(5);
      mockInvitationCount.mockResolvedValue(2);

      const result = await checkUserSlot(WS_ID);
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(7);
      expect(result.limit).toBe(10);
    });

    it("denies when at limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ userSlotsTotal: 5 }),
      );
      mockEmployeeCount.mockResolvedValue(3);
      mockInvitationCount.mockResolvedValue(2);

      const result = await checkUserSlot(WS_ID);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(5);
    });
  });

  describe("requireUserSlot", () => {
    it("returns null when under limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ userSlotsTotal: 10 }),
      );
      mockEmployeeCount.mockResolvedValue(3);
      mockInvitationCount.mockResolvedValue(1);

      const response = await requireUserSlot(WS_ID);
      expect(response).toBeNull();
    });

    it("returns 403 with SUBSCRIPTION_LIMIT when at limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ userSlotsTotal: 5 }),
      );
      mockEmployeeCount.mockResolvedValue(4);
      mockInvitationCount.mockResolvedValue(1);

      const response = await requireUserSlot(WS_ID);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.error).toBe("SUBSCRIPTION_LIMIT");
      expect(body.code).toBe("USER_SLOT_EXCEEDED");
      expect(body.upgradeRequired).toBe(true);
    });
  });

  // ─── PDF Quota Guards ─────────────────────────────────────

  describe("checkPdfQuota", () => {
    it("allows when under monthly limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ pdfsGeneratedThisMonth: 10, pdfsMonthlyLimit: 50 }),
      );

      const result = await checkPdfQuota(WS_ID);
      expect(result.allowed).toBe(true);
      expect(result.generated).toBe(10);
      expect(result.limit).toBe(50);
    });

    it("denies when at monthly limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ pdfsGeneratedThisMonth: 50, pdfsMonthlyLimit: 50 }),
      );

      const result = await checkPdfQuota(WS_ID);
      expect(result.allowed).toBe(false);
    });

    it("resets counter after 30 days", async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      // First call: findUnique returns stale data (triggers reset)
      mockUsageFindUnique
        .mockResolvedValueOnce(
          buildUsageRow({
            pdfsGeneratedThisMonth: 50,
            pdfsResetAt: thirtyOneDaysAgo,
          }),
        )
        // After reset, findUnique returns fresh data
        .mockResolvedValue(
          buildUsageRow({
            pdfsGeneratedThisMonth: 0,
            pdfsResetAt: new Date(),
          }),
        );
      mockUsageUpdate.mockResolvedValue(buildUsageRow());

      const result = await checkPdfQuota(WS_ID);
      expect(result.allowed).toBe(true);
      expect(mockUsageUpdate).toHaveBeenCalled();
    });
  });

  describe("requirePdfQuota", () => {
    it("returns null when under quota", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ pdfsGeneratedThisMonth: 5, pdfsMonthlyLimit: 50 }),
      );

      const response = await requirePdfQuota(WS_ID);
      expect(response).toBeNull();
    });

    it("returns 403 when quota exceeded", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({ pdfsGeneratedThisMonth: 50, pdfsMonthlyLimit: 50 }),
      );

      const response = await requirePdfQuota(WS_ID);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.error).toBe("SUBSCRIPTION_LIMIT");
      expect(body.code).toBe("PDF_QUOTA_EXCEEDED");
      expect(body.upgradeRequired).toBe(true);
    });
  });

  describe("recordPdfGeneration", () => {
    it("increments the PDF counter", async () => {
      mockUsageFindUnique.mockResolvedValue(buildUsageRow());
      mockUsageUpdate.mockResolvedValue(buildUsageRow());

      await recordPdfGeneration(WS_ID);
      expect(mockUsageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WS_ID },
          data: { pdfsGeneratedThisMonth: { increment: 1 } },
        }),
      );
    });
  });

  // ─── Storage Quota Guards ─────────────────────────────────

  describe("checkStorageQuota", () => {
    it("allows when under limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({
          storageBytesUsed: BigInt(100_000_000), // 100 MB
          storageBytesLimit: BigInt(524_288_000), // 500 MB
        }),
      );

      const result = await checkStorageQuota(WS_ID, 1000);
      expect(result.allowed).toBe(true);
    });

    it("denies when upload would exceed limit", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({
          storageBytesUsed: BigInt(524_288_000), // 500 MB (at limit)
          storageBytesLimit: BigInt(524_288_000),
        }),
      );

      const result = await checkStorageQuota(WS_ID, 1000);
      expect(result.allowed).toBe(false);
    });

    it("allows when upload exactly reaches limit", async () => {
      const limit = BigInt(524_288_000);
      const current = limit - BigInt(1000);
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({
          storageBytesUsed: current,
          storageBytesLimit: limit,
        }),
      );

      const result = await checkStorageQuota(WS_ID, 1000);
      expect(result.allowed).toBe(true);
    });
  });

  describe("requireStorageQuota", () => {
    it("returns null when under limit", async () => {
      mockUsageFindUnique.mockResolvedValue(buildUsageRow());

      const response = await requireStorageQuota(WS_ID, 1000);
      expect(response).toBeNull();
    });

    it("returns 403 when storage exceeded", async () => {
      mockUsageFindUnique.mockResolvedValue(
        buildUsageRow({
          storageBytesUsed: BigInt(524_288_000),
          storageBytesLimit: BigInt(524_288_000),
        }),
      );

      const response = await requireStorageQuota(WS_ID, 1000);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.error).toBe("SUBSCRIPTION_LIMIT");
      expect(body.code).toBe("STORAGE_QUOTA_EXCEEDED");
      expect(body.upgradeRequired).toBe(true);
    });
  });

  describe("recordStorageUsage", () => {
    it("increments storage bytes", async () => {
      mockUsageUpdate.mockResolvedValue(buildUsageRow());

      await recordStorageUsage(WS_ID, 5000);
      expect(mockUsageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WS_ID },
          data: { storageBytesUsed: { increment: 5000 } },
        }),
      );
    });
  });

  // ─── compressSignature ────────────────────────────────────

  describe("compressSignature", () => {
    it("returns original data with size tracking when input is provided", async () => {
      // Even if sharp is not available, should return fallback
      const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
      const result = await compressSignature(base64);

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("bytes");
      expect(result).toHaveProperty("format");
      expect(typeof result.bytes).toBe("number");
      expect(result.bytes).toBeGreaterThan(0);
      expect(["png", "webp"]).toContain(result.format);
    });

    it("strips data URL prefix for size calculation", async () => {
      const rawBase64 = "iVBORw0KGgoAAAANSUhEUg==";
      const withPrefix = `data:image/png;base64,${rawBase64}`;

      const result = await compressSignature(withPrefix);
      // Size should be based on raw base64, not the prefix
      expect(result.bytes).toBe(Buffer.from(rawBase64, "base64").length);
    });

    it("handles base64 without data URL prefix", async () => {
      const rawBase64 = "iVBORw0KGgoAAAANSUhEUg==";
      const result = await compressSignature(rawBase64);

      expect(result).toHaveProperty("data");
      expect(result.bytes).toBeGreaterThan(0);
    });
  });
});
