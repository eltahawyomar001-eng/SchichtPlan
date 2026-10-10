// @vitest-environment node
//
// Node, not jsdom: these exercise an API route, and jsdom's TextEncoder
// produces a Uint8Array from a different realm than jose's instanceof check
// accepts, so signing a test token fails outright under the default
// environment.
/**
 * Token purpose and revocation.
 *
 * Mobile tokens are stateless JWTs. Two consequences were unhandled:
 *
 * - The API verified the signature but never read the `type` claim, so a
 *   thirty-day refresh token -- whose only job is to be stored and sent to the
 *   refresh endpoint -- authenticated ordinary API calls.
 * - Nothing could invalidate a token. Logging out deleted the copy on that
 *   device; anything already extracted kept working until it expired. Somebody
 *   resetting a password because their account was compromised changed nothing
 *   for the person holding the token.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as jose from "jose";

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

const SECRET = "test-secret-at-least-32-characters-long";
const bearer = { value: "" };

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => null), // force the Bearer path
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ authorization: bearer.value })),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: mockFindUnique } },
  withWorkspaceContext: (_w: string, fn: (t: unknown) => unknown) => fn({}),
}));
vi.mock("@/lib/workspace-scope", () => ({ enterWorkspaceScope: vi.fn() }));
vi.mock("@/lib/logger", () => {
  const base = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { log: { ...base, withRequestId: () => base } };
});
vi.mock("@/lib/login-lockout", () => ({ isLockedOut: vi.fn(async () => 0) }));

async function sign(claims: Record<string, unknown>, ttl = "24h") {
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(new TextEncoder().encode(SECRET));
}

const dbUser = (tokenVersion = 0) => ({
  id: "u1",
  email: "a@example.test",
  name: "A",
  role: "EMPLOYEE",
  workspaceId: "ws1",
  tokenVersion,
  employee: { id: "e1" },
  workspace: { id: "ws1", name: "WS", onboardingCompleted: true },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // stubEnv, not a bare assignment: under the threads pool every worker shares
  // one process.env, so assigning the secret here leaked into unrelated API
  // tests running concurrently and made their "401 when unauthenticated" cases
  // fail. This restores it after each test.
  vi.stubEnv("NEXTAUTH_SECRET", SECRET);
  mockFindUnique.mockResolvedValue(dbUser(0));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function auth() {
  const { requireAuth } = await import("@/lib/api-response");
  return requireAuth();
}

describe("token purpose", () => {
  it("accepts an access token", async () => {
    bearer.value = `Bearer ${await sign({ sub: "u1", type: "access", tv: 0 })}`;
    expect((await auth()).ok).toBe(true);
  });

  it("refuses a refresh token used as a bearer credential", async () => {
    // Validly signed and unexpired, which is exactly why only the claim can
    // tell the two apart.
    bearer.value = `Bearer ${await sign({ sub: "u1", type: "refresh", tv: 0 }, "30d")}`;
    expect((await auth()).ok).toBe(false);
  });

  it("refuses a token with no type at all", async () => {
    bearer.value = `Bearer ${await sign({ sub: "u1", tv: 0 })}`;
    expect((await auth()).ok).toBe(false);
  });
});

describe("revocation", () => {
  it("accepts a token whose version matches", async () => {
    mockFindUnique.mockResolvedValue(dbUser(3));
    bearer.value = `Bearer ${await sign({ sub: "u1", type: "access", tv: 3 })}`;
    expect((await auth()).ok).toBe(true);
  });

  it("refuses a token issued before a logout or password reset", async () => {
    mockFindUnique.mockResolvedValue(dbUser(4)); // version bumped since
    bearer.value = `Bearer ${await sign({ sub: "u1", type: "access", tv: 3 })}`;
    expect((await auth()).ok).toBe(false);
  });

  it("keeps tokens minted before the column existed working", async () => {
    // They carry no `tv` claim and must count as version 0, or shipping this
    // would have signed out every mobile user and native clock extension at
    // once.
    mockFindUnique.mockResolvedValue(dbUser(0));
    bearer.value = `Bearer ${await sign({ sub: "u1", type: "access" })}`;
    expect((await auth()).ok).toBe(true);
  });

  it("revokes those legacy tokens once something actually bumps the version", async () => {
    mockFindUnique.mockResolvedValue(dbUser(1));
    bearer.value = `Bearer ${await sign({ sub: "u1", type: "access" })}`;
    expect((await auth()).ok).toBe(false);
  });
});

describe("lifetime", () => {
  it("honours a token's own expiry rather than a separate one-hour rule", async () => {
    // Tokens are minted for 24h but were rejected after 1h, so a Live Activity
    // or widget clock-out part-way through an eight-hour shift failed with
    // nothing the user could act on. Revocation is what makes the real
    // lifetime safe to honour.
    const old = await new jose.SignJWT({ sub: "u1", type: "access", tv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 8 * 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) + 16 * 3600)
      .sign(new TextEncoder().encode(SECRET));
    bearer.value = `Bearer ${old}`;
    expect((await auth()).ok).toBe(true);
  });

  it("still refuses a genuinely expired token", async () => {
    const expired = await new jose.SignJWT({ sub: "u1", type: "access", tv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    bearer.value = `Bearer ${expired}`;
    expect((await auth()).ok).toBe(false);
  });
});

/**
 * The refresh endpoint is where revocation is either real or cosmetic.
 *
 * Rejecting the access token alone achieves nothing: the client notices the
 * 401, posts its thirty-day refresh token, and gets a brand-new valid access
 * token back. Someone resetting a password because their account was
 * compromised would have locked out nobody.
 */
describe("refresh endpoint", () => {
  const post = async (refreshToken: string) => {
    const { POST } = await import("@/app/api/auth/mobile/refresh/route");
    return POST(
      new Request("http://localhost/api/auth/mobile/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }) as never,
      undefined as never,
    );
  };

  it("refuses to mint from a refresh token issued before the revocation", async () => {
    mockFindUnique.mockResolvedValue(dbUser(2));
    const res = await post(
      await sign({ sub: "u1", type: "refresh", tv: 1 }, "30d"),
    );
    expect(res.status).toBe(401);
  });

  it("still mints from a current refresh token", async () => {
    mockFindUnique.mockResolvedValue(dbUser(2));
    const res = await post(
      await sign({ sub: "u1", type: "refresh", tv: 2 }, "30d"),
    );
    expect(res.status).toBe(200);
  });

  it("refuses an access token presented to the refresh endpoint", async () => {
    mockFindUnique.mockResolvedValue(dbUser(0));
    const res = await post(await sign({ sub: "u1", type: "access", tv: 0 }));
    expect(res.status).toBe(401);
  });
});
