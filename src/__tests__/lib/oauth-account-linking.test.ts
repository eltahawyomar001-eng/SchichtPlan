/**
 * @vitest-environment node
 *
 * `allowDangerousEmailAccountLinking` is on for the OAuth providers, because a
 * user created by the iOS app has no NextAuth Account row and would otherwise
 * hit OAuthAccountNotLinked on the web. That flag disables NextAuth's built-in
 * protection, so the adapter's linkAccount override has to re-add it.
 *
 * Regression: it only checked for a password, so a *second* Google identity
 * whose verified email matched attached to the same user. One production
 * account ended up with two google Account rows carrying different
 * providerAccountIds, and a genuinely new sign-up silently resumed the old
 * workspace.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUserFindUnique, mockAccountFindFirst, mockCreate } = vi.hoisted(
  () => ({
    mockUserFindUnique: vi.fn(),
    mockAccountFindFirst: vi.fn(),
    mockCreate: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    account: { findFirst: mockAccountFindFirst, create: mockCreate },
  },
}));
vi.mock("@next-auth/prisma-adapter", () => ({
  PrismaAdapter: () => ({ linkAccount: mockCreate }),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const GOOGLE_A = {
  userId: "user_1",
  provider: "google",
  providerAccountId: "117032966228741751644",
  type: "oauth",
};

describe("adapter.linkAccount guard", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let linkAccount: (a: any) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ ok: true });
    const mod = await import("@/lib/auth");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linkAccount = (mod.adapter as any).linkAccount;
  });

  it("links the first OAuth identity to a password-less user", async () => {
    mockUserFindUnique.mockResolvedValue({ hashedPassword: null });
    mockAccountFindFirst.mockResolvedValue(null);
    await expect(linkAccount(GOOGLE_A)).resolves.toBeDefined();
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("refuses to attach OAuth to a password account", async () => {
    mockUserFindUnique.mockResolvedValue({ hashedPassword: "$2a$12$hash" });
    mockAccountFindFirst.mockResolvedValue(null);
    await expect(linkAccount(GOOGLE_A)).rejects.toThrow(
      "OAuthAccountNotLinked",
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses a SECOND, different identity from the same provider", async () => {
    mockUserFindUnique.mockResolvedValue({ hashedPassword: null });
    // The user already has a google account — a different Google identity.
    mockAccountFindFirst.mockResolvedValue({
      providerAccountId: "117995843471309423807",
    });
    await expect(linkAccount(GOOGLE_A)).rejects.toThrow(
      "OAuthAccountNotLinked",
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("is idempotent for the same identity re-linking", async () => {
    mockUserFindUnique.mockResolvedValue({ hashedPassword: null });
    mockAccountFindFirst.mockResolvedValue({
      providerAccountId: GOOGLE_A.providerAccountId,
    });
    await expect(linkAccount(GOOGLE_A)).resolves.toBeDefined();
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
