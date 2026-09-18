/**
 * @vitest-environment node
 *
 * The account you land in must be the account you authenticated as.
 *
 * Upstream logic (the Account table, allowDangerousEmailAccountLinking, the
 * linkAccount guard) decides which user row an OAuth identity maps to. When
 * that mapping is wrong — including when it was wrong historically and left a
 * bad Account row behind — the user is silently signed into someone else's
 * workspace and nothing else in the flow notices. The signIn callback checks
 * the provider-vouched email against the resolved row and refuses on mismatch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUserFindUnique,
  mockSubFindUnique,
  mockAccountCount,
  mockAccountDeleteMany,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockSubFindUnique: vi.fn(),
  mockAccountCount: vi.fn(),
  mockAccountDeleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: vi.fn() },
    subscription: { findUnique: mockSubFindUnique },
    account: { count: mockAccountCount, deleteMany: mockAccountDeleteMany },
  },
}));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/subscription", () => ({
  initializeTrial: vi.fn(),
  provisionStripeCustomer: vi.fn(),
}));

const OAUTH = {
  type: "oauth" as const,
  provider: "google",
  providerAccountId: "117032966228741751644",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let signIn: (args: any) => Promise<boolean>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { authOptions } = await import("@/lib/auth");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signIn = (authOptions.callbacks as any).signIn;
  mockSubFindUnique.mockResolvedValue({ status: "ACTIVE" });
  mockAccountCount.mockResolvedValue(0);
  mockAccountDeleteMany.mockResolvedValue({ count: 1 });
});

describe("OAuth identity must match the resolved account", () => {
  it("refuses, and unlinks nothing, when the row is not a duplicate", async () => {
    // Not a duplicate: likelier a stale address on our side. Unlinking would
    // orphan the user's workspace, so the guard must not touch the data.
    mockAccountCount.mockResolvedValue(0);
    mockUserFindUnique.mockResolvedValue({
      email: "vaayutechgmbh@gmail.com",
      workspaceId: "ws_1",
      hashedPassword: null,
      emailVerified: new Date(),
      workspace: { createdAt: new Date() },
    });

    const result = await signIn({
      user: { id: "user_vaayu" },
      account: OAUTH,
      profile: { email: "jamalbowman99@gmail.com" },
    });

    expect(result).toBe("/login?error=OAuthIdentityMismatch");
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  it("unlinks a duplicate identity so the rightful owner can register", async () => {
    // The resolved user already holds another google account — the shape the
    // old linking bug produced. The identity is freed and the retry resolves.
    mockAccountCount.mockResolvedValue(1);
    mockUserFindUnique.mockResolvedValue({
      email: "vaayutechgmbh@gmail.com",
      workspaceId: "ws_1",
      hashedPassword: null,
      emailVerified: new Date(),
      workspace: { createdAt: new Date() },
    });

    const result = await signIn({
      user: { id: "user_vaayu" },
      account: OAUTH,
      profile: { email: "jamalbowman99@gmail.com" },
    });

    expect(result).toBe("/login?error=OAuthIdentityRelinked");
    expect(mockAccountDeleteMany).toHaveBeenCalledWith({
      where: {
        provider: "google",
        providerAccountId: OAUTH.providerAccountId,
      },
    });
  });

  it("allows the matching identity", async () => {
    mockUserFindUnique.mockResolvedValue({
      email: "vaayutechgmbh@gmail.com",
      workspaceId: "ws_1",
      hashedPassword: null,
      emailVerified: new Date(),
      workspace: { createdAt: new Date() },
    });

    const allowed = await signIn({
      user: { id: "user_vaayu" },
      account: OAUTH,
      profile: { email: "VaayuTechGmbH@Gmail.com" }, // case/spacing insensitive
    });

    expect(allowed).toBe(true);
  });

  it("does not block when the provider withholds the email (Apple relay)", async () => {
    mockUserFindUnique.mockResolvedValue({
      email: "someone@example.com",
      workspaceId: "ws_1",
      hashedPassword: null,
      emailVerified: new Date(),
      workspace: { createdAt: new Date() },
    });

    const allowed = await signIn({
      user: { id: "user_1" },
      account: { ...OAUTH, provider: "apple" },
      profile: {},
    });

    expect(allowed).toBe(true);
  });

  it("leaves credentials sign-in alone", async () => {
    const allowed = await signIn({
      user: { id: "user_1" },
      account: { type: "credentials", provider: "credentials" },
      profile: undefined,
    });

    expect(allowed).toBe(true);
  });
});
