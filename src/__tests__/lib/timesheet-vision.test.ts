// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Control handles for the mocked vendor SDK clients.
const { anthropicCreate, openaiCreate } = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  openaiCreate: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
  },
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));

import {
  extractTimesheet,
  isMockMode,
  ExtractedRowSchema,
  ConfidenceScoresSchema,
} from "@/lib/ai/timesheet-vision";

const IMAGE = { base64: "AAAA", mimeType: "image/jpeg" };

const ROW = {
  employeeName: "Max Mustermann",
  date: "2026-06-10",
  shiftStart: "08:00",
  shiftEnd: "16:30",
  breakMinutes: 30,
  confidenceScores: {
    employeeName: 0.9,
    date: 0.9,
    shiftStart: 0.9,
    shiftEnd: 0.9,
  },
};

describe("timesheet-vision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TIMESHEET_OCR_MOCK;
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.OPENAI_API_KEY = "test";
  });

  describe("schemas", () => {
    it("ConfidenceScoresSchema fills defaults", () => {
      const parsed = ConfidenceScoresSchema.parse({});
      expect(parsed.employeeName).toBe(1);
      expect(parsed.shiftEnd).toBe(1);
    });

    it("ExtractedRowSchema rejects a bad date format", () => {
      expect(() =>
        ExtractedRowSchema.parse({ ...ROW, date: "10.06.2026" }),
      ).toThrow();
    });

    it("ExtractedRowSchema accepts a valid row", () => {
      expect(ExtractedRowSchema.parse(ROW).employeeName).toBe("Max Mustermann");
    });
  });

  describe("mock mode", () => {
    it("isMockMode reflects the env flag", () => {
      expect(isMockMode()).toBe(false);
      process.env.TIMESHEET_OCR_MOCK = "true";
      expect(isMockMode()).toBe(true);
    });

    it("returns deterministic MOCK rows without calling any vendor", async () => {
      process.env.TIMESHEET_OCR_MOCK = "true";
      const out = await extractTimesheet(IMAGE);
      expect(out.source).toBe("MOCK");
      expect(out.rows.length).toBeGreaterThan(0);
      // Includes a low-confidence field to exercise the review UI.
      expect(out.rows.some((r) => r.confidenceScores.date < 0.75)).toBe(true);
      expect(anthropicCreate).not.toHaveBeenCalled();
      expect(openaiCreate).not.toHaveBeenCalled();
    });
  });

  describe("provider path", () => {
    it("uses Anthropic (primary) on success", async () => {
      anthropicCreate.mockResolvedValue({
        content: [{ type: "tool_use", input: { rows: [ROW] } }],
      });
      const out = await extractTimesheet(IMAGE);
      expect(out.source).toBe("ANTHROPIC");
      expect(out.rows).toHaveLength(1);
      expect(openaiCreate).not.toHaveBeenCalled();
    });

    it("fails over to OpenAI when Anthropic throws (e.g. 429)", async () => {
      anthropicCreate.mockRejectedValue(
        Object.assign(new Error("rate"), { status: 429 }),
      );
      openaiCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ rows: [ROW] }) } }],
      });
      const out = await extractTimesheet(IMAGE);
      expect(out.source).toBe("OPENAI");
      expect(out.rows).toHaveLength(1);
      expect(anthropicCreate).toHaveBeenCalledOnce();
      expect(openaiCreate).toHaveBeenCalledOnce();
    });

    it("throws extraction_failed when both providers fail", async () => {
      anthropicCreate.mockRejectedValue(new Error("down"));
      openaiCreate.mockRejectedValue(new Error("down"));
      await expect(extractTimesheet(IMAGE)).rejects.toThrow(
        "extraction_failed",
      );
    });

    it("fails over when Anthropic returns no tool_use block", async () => {
      anthropicCreate.mockResolvedValue({
        content: [{ type: "text", text: "nope" }],
      });
      openaiCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ rows: [ROW] }) } }],
      });
      const out = await extractTimesheet(IMAGE);
      expect(out.source).toBe("OPENAI");
    });
  });
});
