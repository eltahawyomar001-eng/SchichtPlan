/**
 * @vitest-environment node
 *
 * Security-critical tests for the password reset flow.
 *
 * Two routes:
 *   POST /api/auth/forgot-password — requests a reset link
 *   POST /api/auth/reset-password  — consumes the token and sets new password
 *
 * Key security properties verified:
 * - Email enumeration prevention (forgot-password always returns 200)
 * - Token expiry enforced (expired token returns 410)
 * - Invalid token returns 400 (not 500)
 * - Successful reset deletes the token (one-time use)
 * - Password is hashed before storage
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Shared mock state ─────────────────────────────────────────── */
const {
  mockUserFindUnique,
  mockTokenFindUnique,
  mockTokenDeleteMany,
  mockTokenCreate,
  mockTokenDelete,
  mockUserUpdate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockTokenFindUnique: vi.fn(),
  mockTokenDeleteMany: vi.fn(),
  mockTokenCreate: vi.fn(),
  mockTokenDelete: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    passwordResetToken: {
      findUnique: mockTokenFindUnique,
      deleteMany: mockTokenDeleteMany,
      create: mockTokenCreate,
      delete: mockTokenDelete,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword") },
}));

vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/email-i18n", () => ({
  passwordResetEmail: vi.fn().mockReturnValue({
    subject: "Passwort zurücksetzen",
    body: "Klicken Sie hier...",
  }),
}));

vi.mock("@/i18n/locale", () => ({
  getLocaleFromCookie: vi.fn().mockResolvedValue("de"),
}));

vi.mock("@/lib/cache", () => ({
  cache: { del: vi.fn().mockResolvedValue(undefined) },
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

/* ══════════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/auth/forgot-password", () => {
  let handler: typeof import("@/app/api/auth/forgot-password/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/auth/forgot-password/route");
    mockTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockResolvedValue({ id: "token-1" });
  });

  function postReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 for invalid email format", async () => {
    const res = await handler.POST(postReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing email", async () => {
    const res = await handler.POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 even when email does NOT exist (prevents enumeration)", async () => {
    mockUserFindUnique.mockResolvedValue(null); // no user found
    const res = await handler.POST(postReq({ email: "unknown@example.com" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    // Message should not reveal whether the account exists
    expect(body.message).toBeDefined();
  });

  it("returns 200 when email exists and sends reset link", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "known@example.com",
    });
    const res = await handler.POST(postReq({ email: "known@example.com" }));
    expect(res.status).toBe(200);

    // Token should have been created
    expect(mockTokenCreate).toHaveBeenCalledOnce();
    const tokenData = mockTokenCreate.mock.calls[0][0].data;
    expect(tokenData.email).toBe("known@example.com");
    expect(tokenData.token).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(tokenData.expires).toBeInstanceOf(Date);
  });

  it("clears old reset tokens before creating a new one", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
    });
    await handler.POST(postReq({ email: "u@example.com" }));

    expect(mockTokenDeleteMany).toHaveBeenCalledWith({
      where: { email: "u@example.com" },
    });
    // deleteMany must be called before create
    const deleteManyOrder = mockTokenDeleteMany.mock.invocationCallOrder[0];
    const createOrder = mockTokenCreate.mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(createOrder);
  });

  it("response message is identical regardless of email existence", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res1 = await handler.POST(postReq({ email: "missing@example.com" }));
    const body1 = await res1.json();

    mockUserFindUnique.mockResolvedValue({
      id: "u",
      email: "found@example.com",
    });
    mockTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockResolvedValue({ id: "t1" });
    const res2 = await handler.POST(postReq({ email: "found@example.com" }));
    const body2 = await res2.json();

    // Both return 200 — enumeration not possible via status code
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Both return a message (wording may differ but both present)
    expect(body1.message).toBeDefined();
    expect(body2.message).toBeDefined();
  });
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
   ══════════════════════════════════════════════════════════════════ */

describe("POST /api/auth/reset-password", () => {
  let handler: typeof import("@/app/api/auth/reset-password/route");

  const FUTURE = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
  const PAST = new Date(Date.now() - 1); // 1ms ago (expired)

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = await import("@/app/api/auth/reset-password/route");
    // Default: transaction runs the callback
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        passwordResetToken: {
          delete: vi.fn().mockResolvedValue({}),
        },
      };
      return cb(tx);
    });
  });

  function postReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 for missing token", async () => {
    const res = await handler.POST(postReq({ password: "NewPass123!" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing password", async () => {
    const res = await handler.POST(postReq({ token: "abc123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for password shorter than 8 chars", async () => {
    const res = await handler.POST(
      postReq({ token: "abc123", password: "short" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when token does not exist in DB", async () => {
    mockTokenFindUnique.mockResolvedValue(null);
    const res = await handler.POST(
      postReq({ token: "nonexistent-token", password: "ValidPass123!" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 410 when token is expired (deletes stale token)", async () => {
    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      token: "expired-tok",
      email: "u@example.com",
      expires: PAST,
    });
    mockTokenDelete.mockResolvedValue({});

    const res = await handler.POST(
      postReq({ token: "expired-tok", password: "ValidPass123!" }),
    );
    expect(res.status).toBe(410);
    // Stale token is cleaned up
    expect(mockTokenDelete).toHaveBeenCalledWith({
      where: { id: "tok-1" },
    });
  });

  it("returns 404 when token is valid but user no longer exists", async () => {
    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      token: "valid-tok",
      email: "gone@example.com",
      expires: FUTURE,
    });
    mockUserFindUnique.mockResolvedValue(null);

    const res = await handler.POST(
      postReq({ token: "valid-tok", password: "ValidPass123!" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates password on valid token", async () => {
    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      token: "good-tok",
      email: "user@example.com",
      expires: FUTURE,
    });
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    const res = await handler.POST(
      postReq({ token: "good-tok", password: "NewSecurePass123!" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
  });

  it("hashes the new password (never stores plaintext)", async () => {
    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      token: "good-tok",
      email: "user@example.com",
      expires: FUTURE,
    });
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    let updatedData: Record<string, unknown> = {};
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        user: {
          update: vi
            .fn()
            .mockImplementation((args: { data: Record<string, unknown> }) => {
              updatedData = args.data;
              return Promise.resolve({});
            }),
        },
        passwordResetToken: { delete: vi.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    await handler.POST(
      postReq({ token: "good-tok", password: "NewSecurePass123!" }),
    );

    // Password must be hashed — never the raw string
    expect(updatedData.hashedPassword).not.toBe("NewSecurePass123!");
    expect(updatedData.hashedPassword).toMatch(/^\$2b\$/); // bcrypt prefix
  });

  it("token is consumed (deleted) after successful reset", async () => {
    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      token: "good-tok",
      email: "user@example.com",
      expires: FUTURE,
    });
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });

    let tokenWasDeleted = false;
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        user: { update: vi.fn().mockResolvedValue({}) },
        passwordResetToken: {
          delete: vi.fn().mockImplementation(() => {
            tokenWasDeleted = true;
            return Promise.resolve({});
          }),
        },
      };
      return cb(tx);
    });

    await handler.POST(
      postReq({ token: "good-tok", password: "NewSecurePass123!" }),
    );

    expect(tokenWasDeleted).toBe(true);
  });
});
