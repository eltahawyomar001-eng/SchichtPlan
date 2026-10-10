/**
 * Changing the logo has to change its URL.
 *
 * Every upload used to land on one fixed key per workspace, so the URL stayed
 * identical when the image behind it did not. Three caches then served the old
 * bytes -- the Next.js data cache holding the base64 for the PDF, the storage
 * CDN, and the browser -- and a company that changed its logo saw the new one
 * in the app while its invoices kept going out with the old one.
 *
 * These assert the property that makes that impossible rather than the
 * mechanism: new bytes, new URL.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { upload, remove } = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@supabase/storage-js", () => ({
  StorageClient: class {
    from() {
      return { upload, remove };
    }
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PNG = "image/png";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.SUPABASE_URL = "https://proj.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
});

const lib = () => import("@/lib/workspace-logo");

describe("logo URLs", () => {
  it("gives two different images two different URLs", async () => {
    const { uploadWorkspaceLogo } = await lib();
    const a = await uploadWorkspaceLogo("ws1", PNG, Buffer.from("old-logo"));
    const b = await uploadWorkspaceLogo("ws1", PNG, Buffer.from("new-logo"));
    expect(a).not.toBe(b);
  });

  it("gives the same image the same URL, so re-uploading costs nothing", async () => {
    const { uploadWorkspaceLogo } = await lib();
    const a = await uploadWorkspaceLogo("ws1", PNG, Buffer.from("same"));
    const b = await uploadWorkspaceLogo("ws1", PNG, Buffer.from("same"));
    expect(a).toBe(b);
  });

  it("keeps one workspace's logo out of another's folder", async () => {
    const { uploadWorkspaceLogo } = await lib();
    const a = await uploadWorkspaceLogo("ws1", PNG, Buffer.from("x"));
    const b = await uploadWorkspaceLogo("ws2", PNG, Buffer.from("x"));
    expect(a).toContain("workspace-logos/ws1/");
    expect(b).toContain("workspace-logos/ws2/");
    expect(a).not.toBe(b);
  });

  it("asks storage to cache it for a year", async () => {
    // Safe only because the URL names the exact bytes; this is the payoff for
    // content addressing, not an independent decision.
    const { uploadWorkspaceLogo } = await lib();
    await uploadWorkspaceLogo("ws1", PNG, Buffer.from("x"));
    expect(upload.mock.calls[0][2]).toMatchObject({
      cacheControl: "31536000",
    });
  });

  it("never deletes anything while storing a new logo", async () => {
    // It used to clear all four possible extensions before uploading, so an
    // upload that then failed left the workspace with no logo at all. Cleanup
    // belongs after the database points at the replacement.
    const { uploadWorkspaceLogo } = await lib();
    await uploadWorkspaceLogo("ws1", PNG, Buffer.from("x"));
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not lose the logo when storage rejects the upload", async () => {
    upload.mockResolvedValue({ error: { message: "quota exceeded" } });
    const { uploadWorkspaceLogo } = await lib();
    await expect(
      uploadWorkspaceLogo("ws1", PNG, Buffer.from("x")),
    ).rejects.toThrow(/quota exceeded/);
    expect(remove).not.toHaveBeenCalled();
  });

  it("uses the extension matching the uploaded type", async () => {
    const { uploadWorkspaceLogo } = await lib();
    const svg = await uploadWorkspaceLogo(
      "ws1",
      "image/svg+xml",
      Buffer.from("<svg/>"),
    );
    expect(svg.endsWith(".svg")).toBe(true);
  });
});

describe("recognising a content-addressed URL", () => {
  it("accepts what the uploader produces", async () => {
    const { uploadWorkspaceLogo, isContentAddressedLogo } = await lib();
    const url = await uploadWorkspaceLogo("ws1", PNG, Buffer.from("x"));
    // The two must agree, or the caching decision keyed off this is wrong for
    // every logo the uploader writes.
    expect(isContentAddressedLogo(url)).toBe(true);
  });

  it.each([
    "https://p.supabase.co/x/workspace-logos/ws1/logo.png",
    "https://p.supabase.co/x/workspace-logos/ws1/logo.svg",
    "https://p.supabase.co/x/workspace-logos/ws1/company-logo.png",
    "https://cdn.example.test/brand.png",
  ])("treats the legacy or foreign URL %s as mutable", async (url) => {
    const { isContentAddressedLogo } = await lib();
    expect(isContentAddressedLogo(url)).toBe(false);
  });
});
