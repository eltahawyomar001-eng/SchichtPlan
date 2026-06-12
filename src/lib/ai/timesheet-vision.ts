/* ═══════════════════════════════════════════════════════════════
   AI Stundenzettel (timesheet) vision extraction — provider abstraction
   ═══════════════════════════════════════════════════════════════
   ALL external AI calls for timesheet OCR live behind this single
   utility. Callers (the API route) never import the vendor SDKs
   directly, which gives us one place to:

     • Enforce a strict, Zod-validated Structured Output schema.
     • Fail over Anthropic (primary) → OpenAI (secondary) on
       429 / timeout / parse failure, with NO PII in logs.
     • Short-circuit to a deterministic MOCK during development/tests
       so scans never incur real API cost (TIMESHEET_OCR_MOCK=true).

   PRIVACY: image bytes and extracted names/hours are NEVER logged.
   We only ever log the provider, latency, entry COUNT, and error
   status codes.
   ═══════════════════════════════════════════════════════════════ */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { log } from "@/lib/logger";

// ── Models (overridable via env, sensible production defaults) ──────
const ANTHROPIC_MODEL =
  process.env.TIMESHEET_OCR_ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.TIMESHEET_OCR_OPENAI_MODEL ?? "gpt-4o";

/** Mock toggle — when on, no external API is called and no cost is incurred. */
export function isMockMode(): boolean {
  return process.env.TIMESHEET_OCR_MOCK === "true";
}

// ── Structured output contract ─────────────────────────────────────
// The exact JSON shape both providers must return, validated at the
// boundary. A field-level confidence map drives the mandatory
// low-confidence review highlighting in the UI.
export const ConfidenceScoresSchema = z.object({
  employeeName: z.number().min(0).max(1).default(1),
  date: z.number().min(0).max(1).default(1),
  shiftStart: z.number().min(0).max(1).default(1),
  shiftEnd: z.number().min(0).max(1).default(1),
});
export type ConfidenceScores = z.infer<typeof ConfidenceScoresSchema>;

export const ExtractedRowSchema = z.object({
  employeeName: z.string().trim().min(1),
  /** ISO date, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  /** 24h HH:mm. */
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/, "shiftStart must be HH:mm"),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/, "shiftEnd must be HH:mm"),
  breakMinutes: z.number().int().min(0).max(600).default(0),
  confidenceScores: ConfidenceScoresSchema,
});
export type ExtractedRow = z.infer<typeof ExtractedRowSchema>;

const ExtractionResultSchema = z.object({ rows: z.array(ExtractedRowSchema) });

export type ExtractionSource = "ANTHROPIC" | "OPENAI" | "MOCK";
export interface ExtractionOutcome {
  source: ExtractionSource;
  rows: ExtractedRow[];
}

export interface ImagePayload {
  /** Base64-encoded image bytes (no data: prefix). */
  base64: string;
  /** e.g. "image/jpeg", "image/png". */
  mimeType: string;
}

// ── Prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = [
  "You are a precise OCR extraction engine for German handwritten and printed",
  "Stundenzettel (employee timesheets). Extract every shift row you can read.",
  "Return STRICTLY the structured data — no commentary.",
  "Rules:",
  "- date MUST be ISO YYYY-MM-DD. Infer the year from context if visible; if a",
  "  row's year is genuinely ambiguous, lower its date confidence.",
  "- shiftStart/shiftEnd MUST be 24-hour HH:mm.",
  "- breakMinutes is the pause in minutes (0 if none shown).",
  "- For EACH field set a confidence in [0,1]. Use < 0.75 for anything",
  "  handwritten unclearly, smudged, or inferred. Do NOT guess names with high",
  "  confidence — a misread name blocks the import.",
].join("\n");

// JSON Schema describing the tool/structured output (shared shape).
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          employeeName: { type: "string" },
          date: { type: "string", description: "ISO YYYY-MM-DD" },
          shiftStart: { type: "string", description: "24h HH:mm" },
          shiftEnd: { type: "string", description: "24h HH:mm" },
          breakMinutes: {
            type: "integer",
            description: "pause in minutes, 0 if none",
          },
          confidenceScores: {
            type: "object",
            additionalProperties: false,
            properties: {
              employeeName: { type: "number" },
              date: { type: "number" },
              shiftStart: { type: "number" },
              shiftEnd: { type: "number" },
            },
            required: ["employeeName", "date", "shiftStart", "shiftEnd"],
          },
        },
        required: [
          "employeeName",
          "date",
          "shiftStart",
          "shiftEnd",
          "breakMinutes",
          "confidenceScores",
        ],
      },
    },
  },
  required: ["rows"],
} as const;

// ── Primary: Anthropic Claude Sonnet 4.6 (forced tool use) ─────────
async function extractWithAnthropic(
  image: ImagePayload,
): Promise<ExtractedRow[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 0, // we own the failover; don't let the SDK silently retry a 429
    timeout: 45_000,
  });

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tool_choice: { type: "tool", name: "record_timesheet" },
    tools: [
      {
        name: "record_timesheet",
        description: "Record every extracted timesheet shift row.",
        input_schema: JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/gif",
              data: image.base64,
            },
          },
          {
            type: "text",
            text: "Extract all shift rows from this Stundenzettel.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("anthropic_no_tool_use");
  }
  return ExtractionResultSchema.parse(toolUse.input).rows;
}

// ── Secondary: OpenAI GPT-4o (JSON Schema structured outputs) ──────
async function extractWithOpenAI(image: ImagePayload): Promise<ExtractedRow[]> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 45_000,
  });

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 4096,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "timesheet_extraction",
        strict: true,
        schema: JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all shift rows from this Stundenzettel.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
          },
        ],
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("openai_empty_response");
  return ExtractionResultSchema.parse(JSON.parse(content)).rows;
}

// ── Deterministic mock (no external call, no cost) ─────────────────
function mockExtraction(): ExtractedRow[] {
  // Intentionally includes one low-confidence field to exercise the
  // mandatory Review & Edit highlighting end-to-end.
  return [
    {
      employeeName: "Max Mustermann",
      date: "2026-06-10",
      shiftStart: "08:00",
      shiftEnd: "16:30",
      breakMinutes: 30,
      confidenceScores: {
        employeeName: 0.98,
        date: 0.95,
        shiftStart: 0.97,
        shiftEnd: 0.93,
      },
    },
    {
      employeeName: "Erika Musterfrau",
      date: "2026-06-10",
      shiftStart: "09:00",
      shiftEnd: "17:00",
      breakMinutes: 45,
      // low date confidence → must be resolved by the manager before submit
      confidenceScores: {
        employeeName: 0.91,
        date: 0.58,
        shiftStart: 0.88,
        shiftEnd: 0.62,
      },
    },
  ];
}

// ── Public entry point ─────────────────────────────────────────────
/**
 * Extract timesheet rows from a scanned image. Tries Anthropic first and
 * transparently fails over to OpenAI on ANY primary failure (429, timeout,
 * malformed output). Never logs PII — only provider, latency, and counts.
 *
 * @throws Error("extraction_failed") if BOTH providers fail.
 */
export async function extractTimesheet(
  image: ImagePayload,
): Promise<ExtractionOutcome> {
  if (isMockMode()) {
    log.info("timesheet.ocr.extract", { provider: "mock" });
    return { source: "MOCK", rows: mockExtraction() };
  }

  // Primary — Anthropic
  const primaryStart = Date.now();
  try {
    const rows = await extractWithAnthropic(image);
    log.info("timesheet.ocr.extract", {
      provider: "anthropic",
      ms: Date.now() - primaryStart,
      rows: rows.length,
    });
    return { source: "ANTHROPIC", rows };
  } catch (err) {
    // PII-free failure log: status/name only, never the image or text.
    log.warn("timesheet.ocr.primary_failed", {
      provider: "anthropic",
      ms: Date.now() - primaryStart,
      status: (err as { status?: number })?.status ?? null,
      name: (err as Error)?.name ?? "Error",
    });
  }

  // Secondary — OpenAI failover
  const secondaryStart = Date.now();
  try {
    const rows = await extractWithOpenAI(image);
    log.info("timesheet.ocr.extract", {
      provider: "openai_failover",
      ms: Date.now() - secondaryStart,
      rows: rows.length,
    });
    return { source: "OPENAI", rows };
  } catch (err) {
    log.error("timesheet.ocr.all_providers_failed", {
      provider: "openai",
      ms: Date.now() - secondaryStart,
      status: (err as { status?: number })?.status ?? null,
      name: (err as Error)?.name ?? "Error",
    });
    throw new Error("extraction_failed");
  }
}
