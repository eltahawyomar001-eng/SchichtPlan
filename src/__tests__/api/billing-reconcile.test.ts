/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Hoisted mocks ──────────────────────────────────────────── */
const {
  mockGetSubscription,
  mockUpdateFromStripe,
  mockLinkByCustomer,
  mockCancelSubscription,
  mockInvalidateCache,
  mockStripeList,
  mockStripeRetrieve,
} = vi.hoisted(() => ({
  mockGetSubscription: vi.fn(),
  mockUpdateFromStripe: vi.fn(),
  mockLinkByCustomer: vi.fn(),
  mockCancelSubscription: vi.fn(),
  mockInvalidateCache: vi.fn(),
  mockStripeList: vi.fn(),
  mockStripeRetrieve: vi.fn(),
}));

vi.mock("@/lib/subscription", () => ({
  getSubscription: mockGetSubscription,
  updateSubscriptionFromStripe: mockUpdateFromStripe,
  linkSubscriptionByCustomer: mockLinkByCustomer,
  cancelSubscription: mockCancelSubscription,
  invalidateSubscriptionCache: mockInvalidateCache,
  ACTIVE_SUBSCRIPTION_STATUSES: ["ACTIVE", "TRIALING", "PAST_DUE"],
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { list: mockStripeList, retrieve: mockStripeRetrieve },
  }),
}));

vi.mock("@/lib/ticketing-addon", () => ({
  getTicketingTierByPriceId: () => null,
}));
vi.mock("@/lib/schichtplanung-addon", () => ({
  getSchichtplanungBillingByPriceId: () => null,
}));

import { reconcileWorkspaceFromStripe } from "@/lib/billing-reconcile";

/** Helper: a live Stripe subscription object as returned by list/retrieve. */
function stripeSub(
  id: string,
  status: string,
  opts: { cancelAtPeriodEnd?: boolean } = {},
) {
  return {
    id,
    status,
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    items: {
      data: [
        {
          price: { id: "price_basic" },
          quantity: 5,
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_000_000,
        },
      ],
    },
  };
}

describe("reconcileWorkspaceFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeList.mockResolvedValue({ data: [] });
  });

  it("skips a workspace with no Stripe customer", async () => {
    mockGetSubscription.mockResolvedValue({ stripeCustomerId: null });

    const result = await reconcileWorkspaceFromStripe("ws-1");

    expect(result).toEqual({ action: "skipped", reason: "NO_CUSTOMER" });
    expect(mockStripeList).not.toHaveBeenCalled();
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("syncs via update when the live sub matches the DB sub id", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [stripeSub("sub_1", "active")] });

    const result = await reconcileWorkspaceFromStripe("ws-1");

    expect(result.action).toBe("synced");
    expect(mockUpdateFromStripe).toHaveBeenCalledOnce();
    expect(mockLinkByCustomer).not.toHaveBeenCalled();
    expect(mockInvalidateCache).toHaveBeenCalledWith("ws-1");
  });

  it("links by customer when the DB sub id is missing/stale", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      status: "INCOMPLETE",
      seatCount: 1,
    });
    mockStripeList.mockResolvedValue({
      data: [stripeSub("sub_new", "active")],
    });

    const result = await reconcileWorkspaceFromStripe("ws-1");

    expect(result.action).toBe("synced");
    expect(mockLinkByCustomer).toHaveBeenCalledOnce();
    expect(mockUpdateFromStripe).not.toHaveBeenCalled();
  });

  it("prefers an active sub over a past_due one when both exist", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_active",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({
      data: [
        stripeSub("sub_pastdue", "past_due"),
        stripeSub("sub_active", "active"),
      ],
    });

    const result = await reconcileWorkspaceFromStripe("ws-1");

    expect(result).toMatchObject({ action: "synced", status: "active" });
  });

  /* ── Downgrade path — the dangerous one. Must be conservative. ── */

  it("does NOT downgrade when allowDowngrade is off (user-facing sync)", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [] }); // nothing syncable

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: false,
    });

    expect(result.action).toBe("noop");
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("downgrades only when the linked sub is confirmed terminal in Stripe", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [] });
    mockStripeRetrieve.mockResolvedValue(stripeSub("sub_1", "canceled"));

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result.action).toBe("downgraded");
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_1");
    expect(mockInvalidateCache).toHaveBeenCalledWith("ws-1");
  });

  it("treats a 404 resource_missing as terminal and downgrades", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_gone",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [] });
    mockStripeRetrieve.mockRejectedValue({ code: "resource_missing" });

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result.action).toBe("downgraded");
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_gone");
  });

  it("does NOT downgrade when the terminal check is inconclusive (Stripe error)", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [] });
    mockStripeRetrieve.mockRejectedValue({ code: "api_connection_error" });

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result).toEqual({
      action: "skipped",
      reason: "TERMINAL_CHECK_FAILED",
    });
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("does NOT downgrade when the linked sub is still alive in Stripe", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      seatCount: 5,
    });
    // list filters out non-syncable, so e.g. an "incomplete" sub yields []
    mockStripeList.mockResolvedValue({ data: [] });
    mockStripeRetrieve.mockResolvedValue(stripeSub("sub_1", "incomplete"));

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result.action).toBe("noop");
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("never downgrades an in-app trial (no stripeSubscriptionId)", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      status: "TRIALING",
      seatCount: 1,
    });
    mockStripeList.mockResolvedValue({ data: [] });

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result.action).toBe("noop");
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("never downgrades a simulated subscription", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sim_123",
      status: "ACTIVE",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [] });

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result.action).toBe("noop");
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("does NOT downgrade when DB status is already non-granting", async () => {
    mockGetSubscription.mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "CANCELED",
      seatCount: 5,
    });
    mockStripeList.mockResolvedValue({ data: [] });

    const result = await reconcileWorkspaceFromStripe("ws-1", {
      allowDowngrade: true,
    });

    expect(result.action).toBe("noop");
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });
});
