/**
 * @vitest-environment node
 *
 * Tests for Two-Factor Authentication API:
 *   GET    /api/auth/two-factor — setup / status
 *   POST   /api/auth/two-factor — verify and enable
 *   DELETE /api/auth/two-factor — disable
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/types";

/* ── Hoisted mock state ─────────────────────────────────────── */

const {
  mockSession,
  mockUserFindUnique,
  mockUserUpdate,
  mockTotpValidate,
  mockEncrypt,
  mockDecrypt,
  mockIsEncrypted,
} = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockTotpValidate: vi.fn(),
  mockEncrypt: vi.fn(),
  mockDecrypt: vi.fn(),
  mockIsEncrypted: vi.fn(),
}));

/* ── Module mocks ───────────────────────────────────────────── */

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
    requireAuth: vi.fn(async () => {
      if (!mockSession.user) {
        const { NextResponse } = await import("next/server");
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          ),
        };
      }
      return {
        ok: true,
        user: mockSession.user,
        workspaceId: mockSession.user.workspaceId as string,
      };
    }),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
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

vi.mock("@/lib/sentry", () => ({
  captureRouteError: vi.fn(),
}));

vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => null),
  cacheIdempotentResponse: vi.fn(),
}));

// otpauth — mock the TOTP class
vi.mock("otpauth", () => {
  class MockSecret {
    static fromHex(_hex: string) {
      return new MockSecret();
    }
    get base32() {
      return "JBSWY3DPEHPK3PXP";
    }
  }

  class MockTOTP {
    secret = new MockSecret();
    toString() {
      return "otpauth://totp/Shiftfy:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Shiftfy";
    }
    validate(_opts: { token: string; window: number }) {
      return mockTotpValidate(_opts);
    }
  }

  return {
    TOTP: MockTOTP,
    Secret: MockSecret,
  };
});

// qrcode
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,test"),
  },
}));

// bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashed"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// encryption
vi.mock("@/lib/encryption", () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
  isEncrypted: mockIsEncrypted,
}));

/* ── Factories ──────────────────────────────────────────────── */

import { buildOwner } from "../helpers/factories";

/* ══════════════════════════════════════════════════════════════
   GET /api/auth/two-factor
   ══════════════════════════════════════════════════════════════ */

describe("GET /api/auth/two-factor", () => {
  let handler: typeof import("@/app/api/auth/two-factor/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: encryption key present, encrypt/decrypt/isEncrypted work
    process.env.ENCRYPTION_KEY = "a".repeat(64); // valid 32-byte hex
    mockEncrypt.mockImplementation((s: string) => `enc:${s}`);
    mockDecrypt.mockImplementation((s: string) =>
      s.startsWith("enc:") ? s.slice(4) : s,
    );
    mockIsEncrypted.mockReturnValue(false);
    mockUserUpdate.mockResolvedValue({});
    handler = await import("@/app/api/auth/two-factor/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.GET(
      new Request("http://localhost/api/auth/two-factor"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when ENCRYPTION_KEY is not set", async () => {
    mockSession.user = buildOwner();
    delete process.env.ENCRYPTION_KEY;

    const res = await handler.GET(
      new Request("http://localhost/api/auth/two-factor"),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/2FA is not available/i);
  });

  it("returns { enabled: false } when ?status=1 and 2FA is not enabled", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({ twoFactorEnabled: false });

    const res = await handler.GET(
      new Request("http://localhost/api/auth/two-factor?status=1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ enabled: false });
  });

  it("returns { enabled: true } when ?status=1 and 2FA is enabled", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({ twoFactorEnabled: true });

    const res = await handler.GET(
      new Request("http://localhost/api/auth/two-factor?status=1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ enabled: true });
  });

  it("returns { secret, qrCode, otpauthUrl } when setting up with no existing secret", async () => {
    mockSession.user = buildOwner();
    // No existing secret
    mockUserFindUnique.mockResolvedValue({
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });

    const res = await handler.GET(
      new Request("http://localhost/api/auth/two-factor"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("secret");
    expect(body).toHaveProperty("qrCode", "data:image/png;base64,test");
    expect(body).toHaveProperty("otpauthUrl");
    // Should have persisted the new secret
    expect(mockUserUpdate).toHaveBeenCalledOnce();
  });

  it("reuses existing pending secret when user has one and ?force not set", async () => {
    mockSession.user = buildOwner();
    // Existing plain secret (not yet enabled)
    mockUserFindUnique.mockResolvedValue({
      twoFactorSecret: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      twoFactorEnabled: false,
    });
    mockIsEncrypted.mockReturnValue(false);

    const res = await handler.GET(
      new Request("http://localhost/api/auth/two-factor"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("secret");
    // Should NOT have written a new secret to DB (reused existing)
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════
   POST /api/auth/two-factor
   ══════════════════════════════════════════════════════════════ */

describe("POST /api/auth/two-factor", () => {
  let handler: typeof import("@/app/api/auth/two-factor/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    mockEncrypt.mockImplementation((s: string) => `enc:${s}`);
    mockDecrypt.mockImplementation((s: string) =>
      s.startsWith("enc:") ? s.slice(4) : s,
    );
    mockIsEncrypted.mockReturnValue(false);
    mockUserUpdate.mockResolvedValue({});
    handler = await import("@/app/api/auth/two-factor/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.POST(
      new Request("http://localhost/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when no code or token in body", async () => {
    mockSession.user = buildOwner();
    // Must have a secret for it to get past the secret check
    mockUserFindUnique.mockResolvedValue({
      twoFactorSecret: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });

    const res = await handler.POST(
      new Request("http://localhost/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code required/i);
  });

  it("returns 400 when user has no 2FA secret set up yet", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({ twoFactorSecret: null });

    const res = await handler.POST(
      new Request("http://localhost/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/setup 2fa first/i);
  });

  it("returns 400 when TOTP code is invalid", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({
      twoFactorSecret: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    mockTotpValidate.mockReturnValue(null); // invalid

    const res = await handler.POST(
      new Request("http://localhost/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "000000" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid code/i);
  });

  it("returns 200 with { success: true, recoveryCodes } on valid code", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({
      twoFactorSecret: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    mockTotpValidate.mockReturnValue(0); // valid (delta = 0)

    const res = await handler.POST(
      new Request("http://localhost/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.recoveryCodes)).toBe(true);
    expect(body.recoveryCodes).toHaveLength(10);
    // Each recovery code should be an 8-char uppercase hex string
    body.recoveryCodes.forEach((code: string) => {
      expect(typeof code).toBe("string");
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    });
  });

  it("enables twoFactorEnabled and stores hashed recovery codes in DB", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({
      twoFactorSecret: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    mockTotpValidate.mockReturnValue(0);

    await handler.POST(
      new Request("http://localhost/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "123456" }),
      }),
    );

    expect(mockUserUpdate).toHaveBeenCalledOnce();
    const updateCall = mockUserUpdate.mock.calls[0][0];
    expect(updateCall.data.twoFactorEnabled).toBe(true);
    // Hashed recovery codes should be stored as JSON
    const storedCodes = JSON.parse(updateCall.data.twoFactorRecoveryCodes);
    expect(Array.isArray(storedCodes)).toBe(true);
    expect(storedCodes).toHaveLength(10);
    // All stored codes should be the bcrypt hash mock returned
    storedCodes.forEach((c: string) => expect(c).toBe("$2b$12$hashed"));
  });
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/auth/two-factor
   ══════════════════════════════════════════════════════════════ */

describe("DELETE /api/auth/two-factor", () => {
  let handler: typeof import("@/app/api/auth/two-factor/route");

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    mockUserUpdate.mockResolvedValue({});
    handler = await import("@/app/api/auth/two-factor/route");
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.user = null;
    const res = await handler.DELETE(
      new Request("http://localhost/api/auth/two-factor", {
        method: "DELETE",
      }),
    );
    expect(res.status).toBe(401);
  });

  const enabledUser = {
    email: "owner@x.de",
    twoFactorEnabled: true,
    twoFactorSecret: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    twoFactorRecoveryCodes: null,
  };

  it("returns 400 CODE_REQUIRED when no code is supplied", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue(enabledUser);

    const res = await handler.DELETE(
      new Request("http://localhost/api/auth/two-factor", { method: "DELETE" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("CODE_REQUIRED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_CODE when the code does not verify", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue(enabledUser);
    mockTotpValidate.mockReturnValue(null); // wrong TOTP

    const res = await handler.DELETE(
      new Request("http://localhost/api/auth/two-factor", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "000000" }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_CODE");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("idempotent success (no update) when 2FA already disabled", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue({ twoFactorEnabled: false });

    const res = await handler.DELETE(
      new Request("http://localhost/api/auth/two-factor", { method: "DELETE" }),
    );
    expect(res.status).toBe(200);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("clears 2FA fields in DB on a valid TOTP code", async () => {
    mockSession.user = buildOwner();
    mockUserFindUnique.mockResolvedValue(enabledUser);
    mockTotpValidate.mockReturnValue(0); // valid

    const res = await handler.DELETE(
      new Request("http://localhost/api/auth/two-factor", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "123456" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledOnce();
    expect(mockUserUpdate.mock.calls[0][0].data).toMatchObject({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: null,
    });
  });
});
