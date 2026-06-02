/**
 * @vitest-environment node
 *
 * Tests for Stripe Webhook handler:
 *   POST /api/billing/webhook
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Hoisted mock state ─────────────────────────────────────── */

const {
  mockConstructEvent,
  mockStripeEventFindUnique,
  mockStripeEventCreate,
  mockSubscriptionFindFirst,
  mockSubscriptionFindUnique,
  mockSubscriptionCreate,
  mockSubscriptionUpdate,
  mockWorkspaceFindUnique,
  mockUserFindFirst,
  mockActivateSubscription,
  mockUpdateSubscriptionFromStripe,
  mockCancelSubscription,
  mockInvalidateSubscriptionCache,
  mockLinkSubscriptionByCustomer,
  mockSyncUsageLimits,
  mockGetTicketingTierByPriceId,
  mockSyncTicketingLimits,
  mockGetSchichtplanungBillingByPriceId,
  mockInvalidateSchichtplanungAddonCache,
  mockSendEmail,
  mockPaymentFailedEmail,
  mockSubscriptionCreatedEmail,
  mockInvoicePaidEmail,
  mockRedisExists,
  mockRedisSet,
  mockHeadersGet,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockStripeEventFindUnique: vi.fn(),
  mockStripeEventCreate: vi.fn(),
  mockSubscriptionFindFirst: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionCreate: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockActivateSubscription: vi.fn(),
  mockUpdateSubscriptionFromStripe: vi.fn(),
  mockCancelSubscription: vi.fn(),
  mockInvalidateSubscriptionCache: vi.fn(),
  mockLinkSubscriptionByCustomer: vi.fn(),
  mockSyncUsageLimits: vi.fn(),
  mockGetTicketingTierByPriceId: vi.fn(),
  mockSyncTicketingLimits: vi.fn(),
  mockGetSchichtplanungBillingByPriceId: vi.fn(),
  mockInvalidateSchichtplanungAddonCache: vi.fn(),
  mockSendEmail: vi.fn(),
  mockPaymentFailedEmail: vi.fn(),
  mockSubscriptionCreatedEmail: vi.fn(),
  mockInvoicePaidEmail: vi.fn(),
  mockRedisExists: vi.fn(),
  mockRedisSet: vi.fn(),
  // We'll replace this function per-test to control the stripe-signature header
  mockHeadersGet: vi.fn(),
}));

/* ── Module mocks ───────────────────────────────────────────── */

vi.mock("@/lib/db", () => ({
  prisma: {
    stripeEvent: {
      findUnique: mockStripeEventFindUnique,
      create: mockStripeEventCreate,
    },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      findFirst: mockSubscriptionFindFirst,
      create: mockSubscriptionCreate,
      update: mockSubscriptionUpdate,
    },
    workspace: {
      findUnique: mockWorkspaceFindUnique,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: "sub_1",
        status: "active",
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: "si_1",
              price: { id: "price_basic_monthly" },
              quantity: 1,
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      }),
    },
  })),
  getPlanByPriceId: vi.fn().mockReturnValue({ id: "basic" }),
}));

vi.mock("@/lib/subscription", () => ({
  activateSubscription: mockActivateSubscription,
  updateSubscriptionFromStripe: mockUpdateSubscriptionFromStripe,
  cancelSubscription: mockCancelSubscription,
  invalidateSubscriptionCache: mockInvalidateSubscriptionCache,
  linkSubscriptionByCustomer: mockLinkSubscriptionByCustomer,
}));

vi.mock("@/lib/subscription-guard", () => ({
  syncUsageLimits: mockSyncUsageLimits,
}));

vi.mock("@/lib/ticketing-addon", () => ({
  getTicketingTierByPriceId: mockGetTicketingTierByPriceId,
  syncTicketingLimits: mockSyncTicketingLimits,
}));

vi.mock("@/lib/schichtplanung-addon", () => ({
  getSchichtplanungBillingByPriceId: mockGetSchichtplanungBillingByPriceId,
  invalidateSchichtplanungAddonCache: mockInvalidateSchichtplanungAddonCache,
  getSchichtplanungBillingStatus: vi.fn(),
}));

vi.mock("@/lib/notifications/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@/lib/notifications/email-i18n", () => ({
  paymentFailedEmail: mockPaymentFailedEmail,
  subscriptionCreatedEmail: mockSubscriptionCreatedEmail,
  invoicePaidEmail: mockInvoicePaidEmail,
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    exists: mockRedisExists,
    set: mockRedisSet,
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    }),
  ),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

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

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => null),
  cacheIdempotentResponse: vi.fn(),
}));

/* ── Helpers ────────────────────────────────────────────────── */

const VALID_WEBHOOK_SECRET = "test-webhook-secret-that-is-long-enough-32ch";

/** Build a fake checkout.session.completed event */
function makeCheckoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_test",
    type: "checkout.session.completed",
    data: {
      object: {
        client_reference_id: "ws-1",
        subscription: "sub_1",
        customer: "cus_1",
        ...overrides,
      },
    },
  };
}

function makeWebhookRequest(body = "{}") {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
  });
}

/* ══════════════════════════════════════════════════════════════
   POST /api/billing/webhook
   ══════════════════════════════════════════════════════════════ */

describe("POST /api/billing/webhook", () => {
  let handler: typeof import("@/app/api/billing/webhook/route");

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default env
    process.env.STRIPE_WEBHOOK_SECRET = VALID_WEBHOOK_SECRET;
    // Unset Upstash so Redis branch is skipped (avoids constructor call in module init)
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Default header: valid stripe-signature
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === "stripe-signature") return "valid-sig";
      return null;
    });

    // Default: event not yet processed
    mockStripeEventFindUnique.mockResolvedValue(null);
    mockStripeEventCreate.mockResolvedValue({ id: "evt_test" });

    // Default: idempotency helpers
    mockRedisExists.mockResolvedValue(0);
    mockRedisSet.mockResolvedValue(null);

    // Default: subscription functions succeed
    mockActivateSubscription.mockResolvedValue(undefined);
    mockCancelSubscription.mockResolvedValue({ workspaceId: "ws-1" });
    mockInvalidateSubscriptionCache.mockResolvedValue(undefined);
    mockInvalidateSchichtplanungAddonCache.mockResolvedValue(undefined);
    mockSyncUsageLimits.mockResolvedValue(undefined);
    mockGetTicketingTierByPriceId.mockReturnValue(null);
    mockGetSchichtplanungBillingByPriceId.mockReturnValue(null);

    handler = await import("@/app/api/billing/webhook/route");
  });

  /* ── Auth / config guards ─────────────────────────────────── */

  it("returns 403 when STRIPE_WEBHOOK_SECRET is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when STRIPE_WEBHOOK_SECRET is shorter than 32 chars", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "too-short";

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(403);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    mockHeadersGet.mockReturnValue(null);

    // constructEvent should not be called
    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing stripe-signature/i);
  });

  it("returns 400 when Stripe signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid signature/i);
  });

  /* ── Idempotency ──────────────────────────────────────────── */

  it("returns { received: true, duplicate: true } when event already processed", async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent());
    // DB says event already exists
    mockStripeEventFindUnique.mockResolvedValue({ id: "evt_test" });

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, duplicate: true });
    // Should NOT activate subscription again
    expect(mockActivateSubscription).not.toHaveBeenCalled();
  });

  /* ── checkout.session.completed ──────────────────────────── */

  it("calls activateSubscription with workspaceId and subscription details", async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent());
    mockStripeEventCreate.mockResolvedValue({ id: "evt_test" });

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    expect(mockActivateSubscription).toHaveBeenCalledOnce();
    const callArgs = mockActivateSubscription.mock.calls[0][0];
    expect(callArgs.workspaceId).toBe("ws-1");
    expect(callArgs.stripeCustomerId).toBe("cus_1");
    expect(callArgs.stripeSubscriptionId).toBe("sub_1");
  });

  /* ── customer.subscription.deleted ───────────────────────── */

  it("calls cancelSubscription when customer.subscription.deleted event received", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_cancel",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
        },
      },
    });
    mockStripeEventCreate.mockResolvedValue({ id: "evt_cancel" });

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    expect(mockCancelSubscription).toHaveBeenCalledOnce();
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_1");
  });

  /* ── Unknown event type ───────────────────────────────────── */

  it("returns { received: true } with 200 for unknown event types", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_unknown",
      type: "some.unknown.event",
      data: { object: {} },
    });
    mockStripeEventCreate.mockResolvedValue({ id: "evt_unknown" });

    const res = await handler.POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true });
    // Should not have called any subscription handler
    expect(mockActivateSubscription).not.toHaveBeenCalled();
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });
});
