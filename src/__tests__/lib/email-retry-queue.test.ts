/**
 * The retry queue must drain, not grow.
 *
 * sendEmail persists a queue row when delivery finally fails, so that a cron
 * can try again later. The cron retries by calling sendEmail -- which means
 * that without a guard, a failed retry persists a SECOND row for a message
 * that already has one, and every cron pass multiplies the backlog.
 *
 * That is not hypothetical: one undeliverable address produced 11,061 rows in
 * two days, roughly one every eighteen seconds, while the Resend key was
 * rejected.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockSend } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { emailJob: { create: mockCreate } },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendEmail } from "@/lib/notifications/email";

const params = {
  to: "someone@example.com",
  type: "SYSTEM",
  category: "transactional" as const,
  title: "T",
  message: "M",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test_key";
  // Every attempt fails, the way an invalid API key fails.
  mockSend.mockResolvedValue({ error: { message: "API key is invalid" } });
});

describe("a first-time send", () => {
  it("queues a row so the cron can retry it", async () => {
    const r = await sendEmail(params);
    expect(r.success).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe("a retry from the cron", () => {
  it("does NOT queue a second row for the same message", async () => {
    // The cron already owns a row for this message. Persisting here is what
    // turned one failure into eleven thousand.
    const r = await sendEmail({ ...params, persistOnFailure: false });
    expect(r.success).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("still reports the failure to its caller", async () => {
    // The cron needs the result to decide PENDING vs FAILED and the back-off.
    const r = await sendEmail({ ...params, persistOnFailure: false });
    expect(r.error).toContain("API key is invalid");
  });

  it("does not queue on success either", async () => {
    mockSend.mockResolvedValue({ data: { id: "x" } });
    const r = await sendEmail({ ...params, persistOnFailure: false });
    expect(r.success).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("messages carrying attachments", () => {
  it("are never queued, because the queue cannot hold the file", async () => {
    // A retry would deliver the mail WITHOUT its invoice, which the recipient
    // would reasonably read as the invoice having been sent.
    const r = await sendEmail({
      ...params,
      attachments: [{ filename: "x.xml", content: "<x/>" }],
    });
    expect(r.success).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
