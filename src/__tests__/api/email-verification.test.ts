/**
 * @vitest-environment node
 *
 * Tests for the email verification flow:
 *   POST /api/auth/verify-email         — consumes token, marks email verified
 *   POST /api/auth/resend-verification  — re-sends verification email
 *
 * Security properties:
 * - resend-verification always returns 200 (prevents enumeration of verified/unverified)
 * - verify-email returns clear errors for invalid/expired tokens
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyEmailToken, mockUserFindUnique, mockSendVerificationEmail } =
  vi.hoisted(() => ({
    mockVerifyEmailToken: vi.fn(),
    mockUserFindUnique: vi.fn(),
    mockSendVerificationEmail: vi.fn(),
  }));

vi.mock("@/lib/verification", () => ({
  verifyEmailToken: mockVerifyEmailToken,
  sendVerificationEmail: mockSendVerificationEmail,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
  },
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

vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));

function postReq(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ══════════════════════════════════════════════════════════════════
   POST /api/auth/verify-email
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/auth/verify-email", () => {
  let handler: typeof import("@/app/api/auth/verify-email/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/auth/verify-email/route");
  });

  it("returns 400 when body is missing token or email", async () => {
    const res = await handler.POST(
      postReq("http://localhost/api/auth/verify-email", {}),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is invalid", async () => {
    mockVerifyEmailToken.mockResolvedValue({
      valid: false,
      error: "INVALID_TOKEN",
    });
    const res = await handler.POST(
      postReq("http://localhost/api/auth/verify-email", {
        token: "bad-token",
        email: "user@example.com",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Ungültiger");
  });

  it("returns 400 when token is expired", async () => {
    mockVerifyEmailToken.mockResolvedValue({
      valid: false,
      error: "TOKEN_EXPIRED",
    });
    const res = await handler.POST(
      postReq("http://localhost/api/auth/verify-email", {
        token: "expired-token",
        email: "user@example.com",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("abgelaufen");
  });

  it("returns 200 with success message on valid token", async () => {
    mockVerifyEmailToken.mockResolvedValue({ valid: true });
    const res = await handler.POST(
      postReq("http://localhost/api/auth/verify-email", {
        token: "valid-token",
        email: "user@example.com",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("bestätigt");
  });

  it("calls verifyEmailToken with correct args", async () => {
    mockVerifyEmailToken.mockResolvedValue({ valid: true });
    await handler.POST(
      postReq("http://localhost/api/auth/verify-email", {
        token: "tok-abc",
        email: "alice@example.com",
      }),
    );
    expect(mockVerifyEmailToken).toHaveBeenCalledWith(
      "tok-abc",
      "alice@example.com",
    );
  });

  it("returns 400 with generic message for unknown error codes", async () => {
    mockVerifyEmailToken.mockResolvedValue({
      valid: false,
      error: "UNKNOWN_ERROR",
    });
    const res = await handler.POST(
      postReq("http://localhost/api/auth/verify-email", {
        token: "tok",
        email: "u@example.com",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/auth/resend-verification
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/auth/resend-verification", () => {
  let handler: typeof import("@/app/api/auth/resend-verification/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/auth/resend-verification/route");
    mockSendVerificationEmail.mockResolvedValue(undefined);
  });

  it("returns 400 for missing or invalid email", async () => {
    const res = await handler.POST(
      postReq("http://localhost/api/auth/resend-verification", {}),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 even when email does not exist (prevents enumeration)", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await handler.POST(
      postReq("http://localhost/api/auth/resend-verification", {
        email: "nobody@example.com",
      }),
    );
    expect(res.status).toBe(200);
    // Does NOT send email
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns 200 even when email is already verified (prevents enumeration)", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u-1",
      emailVerified: new Date(),
    });
    const res = await handler.POST(
      postReq("http://localhost/api/auth/resend-verification", {
        email: "verified@example.com",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends verification email for unverified account", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u-1",
      emailVerified: null, // not yet verified
    });
    const res = await handler.POST(
      postReq("http://localhost/api/auth/resend-verification", {
        email: "unverified@example.com",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      "unverified@example.com",
    );
  });

  it("response body contains a message in all paths", async () => {
    // Path 1: user not found
    mockUserFindUnique.mockResolvedValue(null);
    const res1 = await handler.POST(
      postReq("http://localhost/api/auth/resend-verification", {
        email: "a@example.com",
      }),
    );
    expect((await res1.json()).message).toBeDefined();

    // Path 2: unverified user
    mockUserFindUnique.mockResolvedValue({ id: "u", emailVerified: null });
    const res2 = await handler.POST(
      postReq("http://localhost/api/auth/resend-verification", {
        email: "b@example.com",
      }),
    );
    expect((await res2.json()).message).toBeDefined();
  });
});
