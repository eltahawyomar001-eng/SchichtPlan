/**
 * The logo must never cost somebody their invoice.
 *
 * Every test here asks the same question from a different angle: when the
 * logo cannot be had, does the caller still get a document? An invoice is a
 * legal record a customer is waiting for; a decorative image is not worth
 * failing it over.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadInvoiceLogo } from "@/lib/invoice-logo";

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function mockFetch(body: Buffer, contentType: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("a usable logo", () => {
  it("returns base64 PNG", async () => {
    vi.stubGlobal("fetch", mockFetch(png, "image/png"));
    const logo = await loadInvoiceLogo("https://example.test/logo.png");
    expect(logo?.format).toBe("PNG");
    expect(logo?.data).toBe(png.toString("base64"));
  });

  it("maps jpeg to the name jsPDF expects", async () => {
    vi.stubGlobal("fetch", mockFetch(png, "image/jpeg"));
    expect((await loadInvoiceLogo("https://example.test/l.jpg"))?.format).toBe(
      "JPEG",
    );
  });

  it("tolerates a charset on the content type", async () => {
    vi.stubGlobal("fetch", mockFetch(png, "image/png; charset=binary"));
    expect(await loadInvoiceLogo("https://example.test/l.png")).not.toBeNull();
  });
});

describe("everything that can go wrong yields null, never a throw", () => {
  it("no logo stored", async () => {
    expect(await loadInvoiceLogo(null)).toBeNull();
    expect(await loadInvoiceLogo(undefined)).toBeNull();
    expect(await loadInvoiceLogo("")).toBeNull();
  });

  it("storage returns an error", async () => {
    vi.stubGlobal("fetch", mockFetch(png, "image/png", false, 404));
    expect(await loadInvoiceLogo("https://example.test/gone.png")).toBeNull();
  });

  it("the network fails outright", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    expect(await loadInvoiceLogo("https://example.test/l.png")).toBeNull();
  });

  it("the request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("timeout"), { name: "TimeoutError" }),
        ),
    );
    expect(await loadInvoiceLogo("https://example.test/slow.png")).toBeNull();
  });

  it("the logo is an SVG", async () => {
    // Valid everywhere else in the product; jsPDF simply cannot draw it. Not
    // an error, so it is skipped rather than rejected at upload time.
    vi.stubGlobal("fetch", mockFetch(png, "image/svg+xml"));
    expect(await loadInvoiceLogo("https://example.test/l.svg")).toBeNull();
  });

  it("the response is empty", async () => {
    vi.stubGlobal("fetch", mockFetch(Buffer.alloc(0), "image/png"));
    expect(await loadInvoiceLogo("https://example.test/l.png")).toBeNull();
  });

  it("the file is implausibly large", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(Buffer.alloc(3 * 1024 * 1024), "image/png"),
    );
    expect(await loadInvoiceLogo("https://example.test/huge.png")).toBeNull();
  });

  it("the content type is missing entirely", async () => {
    vi.stubGlobal("fetch", mockFetch(png, ""));
    expect(await loadInvoiceLogo("https://example.test/l")).toBeNull();
  });
});
