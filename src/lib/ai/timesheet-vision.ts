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

   SHEET SHAPE: most German Stundenzettel name the employee ONCE in a
   header ("Name" + "Personal-Nr.") with rows that only carry
   Datum/Beginn/Ende/Pause. We therefore extract a document-level
   `employee` header AND allow an optional per-row name (for the rarer
   multi-employee roster sheets). The route resolves each row's identity
   from the row name first, then the header.

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
// A field-level confidence map drives the mandatory low-confidence
// review highlighting in the UI.
export const ConfidenceScoresSchema = z.object({
  date: z.number().min(0).max(1).default(1),
  shiftStart: z.number().min(0).max(1).default(1),
  shiftEnd: z.number().min(0).max(1).default(1),
});
export type ConfidenceScores = z.infer<typeof ConfidenceScoresSchema>;

/** Document-level employee header (the common single-employee sheet). */
export const ExtractedHeaderSchema = z.object({
  /** Name from the "Name" header field, or null if the sheet has none. */
  name: z.string().trim().nullable().default(null),
  /** "Personal-Nr." / personnel number, or null. Preferred match key. */
  personnelNumber: z.string().trim().nullable().default(null),
  /** Confidence in the header identity (name/number). */
  confidence: z.number().min(0).max(1).default(1),
});
export type ExtractedHeader = z.infer<typeof ExtractedHeaderSchema>;

export const ExtractedRowSchema = z.object({
  /**
   * Per-row name — ONLY present on multi-employee roster sheets that have
   * a name column. Null on the common single-employee sheet (use header).
   */
  employeeName: z.string().trim().nullable().default(null),
  /** ISO date, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  /** 24h HH:mm. */
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/, "shiftStart must be HH:mm"),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/, "shiftEnd must be HH:mm"),
  breakMinutes: z.number().int().min(0).max(600).default(0),
  confidenceScores: ConfidenceScoresSchema,
});
export type ExtractedRow = z.infer<typeof ExtractedRowSchema>;

const ExtractionResultSchema = z.object({
  employee: ExtractedHeaderSchema,
  rows: z.array(ExtractedRowSchema),
});

export type ExtractionSource = "ANTHROPIC" | "OPENAI" | "MOCK";
export interface ExtractionOutcome {
  source: ExtractionSource;
  employee: ExtractedHeader;
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
  "You are a precise OCR extraction engine for German Stundenzettel (employee",
  "timesheets), both handwritten and printed. Return STRICTLY structured data.",
  "",
  "IDENTITY (very important):",
  "- Most sheets name the employee ONCE in a header area: a 'Name' field and",
  "  often a 'Personal-Nr.' (personnel number). Put these in `employee.name`",
  "  and `employee.personnelNumber`. If a field is absent, use null.",
  "- Set `employee.confidence` lower when the name/number is unclear.",
  "- Only set a row's `employeeName` when the TABLE ITSELF has a per-row name",
  "  column (multi-employee roster). On a single-employee sheet leave every",
  "  row's employeeName = null — do NOT copy the header name into rows.",
  "",
  "ROWS:",
  "- Output one row per worked day that has BOTH a start and end time.",
  "- SKIP empty days (e.g. weekends / rows with no Beginn/Ende). Never emit a",
  "  row without times.",
  "- date MUST be ISO YYYY-MM-DD (infer the year from the Zeitraum/header).",
  "- shiftStart/shiftEnd MUST be 24-hour HH:mm. breakMinutes = Pause in minutes.",
  "- Per field set a confidence in [0,1]; use < 0.75 for anything unclear.",
].join("\n");

// JSON Schema describing the structured output (shared shape). Optional fields
// use nullable types so OpenAI strict mode (all keys required) is satisfied.
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    employee: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"], description: "header Name field" },
        personnelNumber: {
          type: ["string", "null"],
          description: "Personal-Nr. / personnel number",
        },
        confidence: { type: "number" },
      },
      required: ["name", "personnelNumber", "confidence"],
    },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          employeeName: {
            type: ["string", "null"],
            description:
              "per-row name ONLY on multi-employee sheets, else null",
          },
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
              date: { type: "number" },
              shiftStart: { type: "number" },
              shiftEnd: { type: "number" },
            },
            required: ["date", "shiftStart", "shiftEnd"],
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
  required: ["employee", "rows"],
} as const;

// ── Primary: Anthropic Claude Sonnet 4.6 (forced tool use) ─────────
async function extractWithAnthropic(
  image: ImagePayload,
): Promise<{ employee: ExtractedHeader; rows: ExtractedRow[] }> {
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
        description: "Record the employee header and every worked shift row.",
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
            text: "Extract the employee header and all worked shift rows from this Stundenzettel.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("anthropic_no_tool_use");
  }
  return ExtractionResultSchema.parse(toolUse.input);
}

// ── Secondary: OpenAI GPT-4o (JSON Schema structured outputs) ──────
async function extractWithOpenAI(
  image: ImagePayload,
): Promise<{ employee: ExtractedHeader; rows: ExtractedRow[] }> {
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
            text: "Extract the employee header and all worked shift rows from this Stundenzettel.",
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
  return ExtractionResultSchema.parse(JSON.parse(content));
}

// ── Deterministic mock (no external call, no cost) ─────────────────
function mockExtraction(): { employee: ExtractedHeader; rows: ExtractedRow[] } {
  // Models the common single-employee sheet (name in header, no row names),
  // with one low-confidence field to exercise the Review & Edit highlighting.
  return {
    employee: {
      name: "Max Mustermann",
      personnelNumber: "123456",
      confidence: 0.96,
    },
    rows: [
      {
        employeeName: null,
        date: "2026-06-01",
        shiftStart: "08:13",
        shiftEnd: "16:59",
        breakMinutes: 43,
        confidenceScores: { date: 0.95, shiftStart: 0.97, shiftEnd: 0.93 },
      },
      {
        employeeName: null,
        date: "2026-06-02",
        shiftStart: "07:54",
        shiftEnd: "13:23",
        breakMinutes: 32,
        // low date confidence → must be resolved by the manager before submit
        confidenceScores: { date: 0.58, shiftStart: 0.88, shiftEnd: 0.9 },
      },
    ],
  };
}

// ── Public entry point ─────────────────────────────────────────────
/**
 * Extract the employee header + worked rows from a scanned image. Tries
 * Anthropic first and transparently fails over to OpenAI on ANY primary
 * failure (429, timeout, malformed output). Never logs PII — only provider,
 * latency, and counts.
 *
 * @throws Error("extraction_failed") if BOTH providers fail.
 */
export async function extractTimesheet(
  image: ImagePayload,
): Promise<ExtractionOutcome> {
  if (isMockMode()) {
    log.info("timesheet.ocr.extract", { provider: "mock" });
    return { source: "MOCK", ...mockExtraction() };
  }

  // Primary — Anthropic
  const primaryStart = Date.now();
  try {
    const result = await extractWithAnthropic(image);
    log.info("timesheet.ocr.extract", {
      provider: "anthropic",
      ms: Date.now() - primaryStart,
      rows: result.rows.length,
    });
    return { source: "ANTHROPIC", ...result };
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
    const result = await extractWithOpenAI(image);
    log.info("timesheet.ocr.extract", {
      provider: "openai_failover",
      ms: Date.now() - secondaryStart,
      rows: result.rows.length,
    });
    return { source: "OPENAI", ...result };
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
