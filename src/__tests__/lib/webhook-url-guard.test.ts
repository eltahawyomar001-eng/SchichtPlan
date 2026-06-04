// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DNS so hostname cases are hermetic (no real network).
const lookupMock = vi.fn();
vi.mock("dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import {
  isPrivateOrReservedIp,
  assertPublicWebhookUrl,
} from "@/lib/webhook-url-guard";

describe("isPrivateOrReservedIp", () => {
  it("flags private / loopback / link-local / reserved IPv4", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.1",
      "127.0.0.1",
      "100.64.0.1",
      "169.254.169.254",
      "172.16.5.5",
      "172.31.255.255",
      "192.168.1.1",
      "198.18.0.1",
      "224.0.0.1",
      "240.0.0.1",
    ]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(false);
    }
  });

  it("handles IPv6 (loopback, ULA, link-local, mapped) and public", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("2606:4700:4700::1111")).toBe(false);
  });

  it("treats malformed input as unsafe", () => {
    expect(isPrivateOrReservedIp("not-an-ip")).toBe(true);
    expect(isPrivateOrReservedIp("999.1.1.1")).toBe(true);
  });
});

describe("assertPublicWebhookUrl", () => {
  beforeEach(() => lookupMock.mockReset());

  it("rejects internal hostnames without DNS", async () => {
    expect((await assertPublicWebhookUrl("http://localhost/x")).ok).toBe(false);
    expect((await assertPublicWebhookUrl("https://foo.internal/x")).ok).toBe(
      false,
    );
  });

  it("rejects literal private/metadata IPs", async () => {
    expect(
      (await assertPublicWebhookUrl("https://169.254.169.254/latest")).ok,
    ).toBe(false);
    expect((await assertPublicWebhookUrl("http://10.0.0.5/hook")).ok).toBe(
      false,
    );
  });

  it("rejects non-http(s) schemes and embedded credentials", async () => {
    expect((await assertPublicWebhookUrl("ftp://example.com/x")).ok).toBe(
      false,
    );
    expect(
      (await assertPublicWebhookUrl("https://user:pass@example.com/x")).ok,
    ).toBe(false);
  });

  it("enforces https when requireHttps is set", async () => {
    expect(
      (
        await assertPublicWebhookUrl("http://example.com/x", {
          requireHttps: true,
        })
      ).ok,
    ).toBe(false);
  });

  it("rejects a public hostname that resolves to a private IP (rebinding)", async () => {
    lookupMock.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    expect(
      (await assertPublicWebhookUrl("https://evil.example.com/x")).ok,
    ).toBe(false);
  });

  it("allows a public hostname that resolves to a public IP", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const r = await assertPublicWebhookUrl("https://example.com/x", {
      requireHttps: true,
    });
    expect(r.ok).toBe(true);
  });
});
