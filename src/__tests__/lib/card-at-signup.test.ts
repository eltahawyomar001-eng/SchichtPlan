/**
 * @vitest-environment node
 *
 * Card-at-signup gate.
 *
 * The switch controls whether every existing card-less trial loses dashboard
 * access, so the cases that matter most are the ones where it must NOT fire:
 * flag off, and roles that cannot subscribe anyway.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/cache", () => ({
  cache: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn(), PLANS: {} }));

import { requiresPaymentMethodSetup, TRIAL_DAYS } from "@/lib/subscription";

const ORIGINAL = process.env.REQUIRE_CARD_AT_SIGNUP;

beforeEach(() => {
  delete process.env.REQUIRE_CARD_AT_SIGNUP;
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.REQUIRE_CARD_AT_SIGNUP;
  else process.env.REQUIRE_CARD_AT_SIGNUP = ORIGINAL;
});

describe("requiresPaymentMethodSetup", () => {
  it("is OFF by default, so deploying the code changes nothing", () => {
    expect(requiresPaymentMethodSetup("OWNER")).toBe(false);
    expect(requiresPaymentMethodSetup("ADMIN")).toBe(false);
  });

  it("stays off for any value other than the exact string 'true'", () => {
    for (const v of ["false", "1", "TRUE", "yes", ""]) {
      process.env.REQUIRE_CARD_AT_SIGNUP = v;
      expect(requiresPaymentMethodSetup("OWNER")).toBe(false);
    }
  });

  it("gates OWNER and ADMIN when enabled", () => {
    process.env.REQUIRE_CARD_AT_SIGNUP = "true";
    expect(requiresPaymentMethodSetup("OWNER")).toBe(true);
    expect(requiresPaymentMethodSetup("ADMIN")).toBe(true);
  });

  it("never gates roles that cannot subscribe", () => {
    // Blocking an employee would strand them: only owners/admins can reach
    // checkout, so an employee has no way to clear the block.
    process.env.REQUIRE_CARD_AT_SIGNUP = "true";
    expect(requiresPaymentMethodSetup("MANAGER")).toBe(false);
    expect(requiresPaymentMethodSetup("EMPLOYEE")).toBe(false);
    expect(requiresPaymentMethodSetup(null)).toBe(false);
    expect(requiresPaymentMethodSetup(undefined)).toBe(false);
  });
});

describe("TRIAL_DAYS", () => {
  it("is 14 days", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});
