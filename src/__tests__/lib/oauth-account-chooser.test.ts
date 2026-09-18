/**
 * @vitest-environment node
 *
 * Every OAuth provider that supports an account chooser must force it.
 *
 * Without `prompt=select_account`, Google (and Microsoft) silently reuse
 * whichever account is already active in the browser and return that identity.
 * The user picks "Continue with Google" intending one address, is signed into
 * another, and nothing on screen says so — it reads as the app sending them to
 * someone else's account. Anyone signed into more than one Google account can
 * hit it, so this is a general defect, not a property of particular accounts.
 *
 * The assertions run through next-auth's own `parseProviders`, because a
 * provider's user options are not readable off `authOptions.providers` — v4
 * stashes them under `.options` and deep-merges them at request time. Checking
 * the merged result also proves the override does not clobber the default
 * `scope`, which would break sign-in outright.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Providers whose protocol exposes an account chooser. Apple has none. */
const MUST_CHOOSE = ["google", "azure-ad"];

type Parsed = {
  id: string;
  type: string;
  authorization?: { params?: Record<string, unknown> };
};

let parsed: Parsed[];

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID ||= "test-google-id";
  process.env.GOOGLE_CLIENT_SECRET ||= "test-google-secret";
  process.env.AZURE_AD_CLIENT_ID ||= "test-azure-id";
  process.env.AZURE_AD_CLIENT_SECRET ||= "test-azure-secret";

  const { authOptions } = await import("@/lib/auth");

  // next-auth does not export this subpath, so load the file directly. This is
  // deliberate: asserting against the real merge is the whole point — a
  // hand-rolled copy would only test the copy.
  const { createRequire } = await import("module");
  const require_ = createRequire(import.meta.url);
  const { join } = await import("path");
  // An absolute path bypasses the package's "exports" map, which does not
  // expose this internal module.
  const providersPath = join(
    process.cwd(),
    "node_modules/next-auth/core/lib/providers.js",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = require_(providersPath) as any;
  const parseProviders = (mod.default ?? mod) as (p: {
    providers: unknown[];
    url: URL;
    providerId?: string;
  }) => { providers: Parsed[] };

  parsed = parseProviders({
    providers: authOptions.providers ?? [],
    url: new URL("https://example.test/api/auth"),
  }).providers;
});

describe("OAuth account chooser", () => {
  it("configures the providers under test", () => {
    const ids = parsed.map((p) => p.id);
    for (const id of MUST_CHOOSE) expect(ids).toContain(id);
  });

  it.each(MUST_CHOOSE)("forces prompt=select_account on %s", (id) => {
    const provider = parsed.find((p) => p.id === id);
    expect(provider?.authorization?.params?.prompt).toBe("select_account");
  });

  it.each(MUST_CHOOSE)("still requests the default scopes on %s", (id) => {
    // Overriding `authorization` wholesale would drop `scope` and break
    // sign-in. The deep merge must keep it.
    const scope = parsed.find((p) => p.id === id)?.authorization?.params?.scope;
    expect(typeof scope).toBe("string");
    expect(scope).toContain("email");
  });
});
