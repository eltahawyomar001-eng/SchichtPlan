/* ─────────────────────────────────────────────────────────────────
   POST /api/timesheet/ocr
   ─────────────────────────────────────────────────────────────────
   Shared endpoint for BOTH web (drag-drop) and mobile (camera) uploads.
   Accepts a multipart/form-data image + workspace_id, runs server-side
   AI vision extraction (mock-able, with Anthropic→OpenAI failover),
   matches names against active employees in the caller's workspace, and
   STAGES the result as PENDING_REVIEW with a full audit trail.

   Privacy / Datenschutz:
     • All AI processing is server-side only (never the client).
     • The image is processed in memory and never written to disk — there
       is no temp file to leak; only a SHA-256 documentRef is retained.
     • No PII (names, hours, raw text) is ever logged.
     • Tenant isolation: the authenticated workspace wins; a mismatched
       client-supplied workspace_id is rejected.
   ───────────────────────────────────────────────────────────────── */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { withWorkspaceContext } from "@/lib/db";
import {
  requireAuth,
  badRequest,
  forbidden,
  payloadTooLarge,
  serverError,
} from "@/lib/api-response";
import { requireManagement } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { extractTimesheet, type ExtractedRow } from "@/lib/ai/timesheet-vision";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Normalize a person name for tolerant matching (case/space/diacritics-insensitive). */
function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a personnel number for matching (strip spaces/punctuation, lower). */
function normalizePnr(input: string): string {
  return input.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export const POST = withRoute("/api/timesheet/ocr", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  // Only managers/owners may import timesheets.
  const gate = requireManagement(user);
  if (gate) return gate;

  // ── Parse multipart payload ──────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Invalid multipart form data");
  }

  const file = form.get("file");
  const bodyWorkspaceId = form.get("workspace_id");

  if (!(file instanceof File)) {
    return badRequest("Missing 'file' upload");
  }
  // Tenant isolation: never trust the client's workspace_id over the session.
  if (typeof bodyWorkspaceId === "string" && bodyWorkspaceId !== workspaceId) {
    return forbidden("workspace_id does not match the authenticated workspace");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return badRequest("Unsupported file type. Use JPEG, PNG, or WebP.");
  }
  if (file.size > MAX_BYTES) {
    return payloadTooLarge("Image exceeds the 10 MB limit");
  }

  // Read bytes in memory — nothing is written to disk.
  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  // Non-PII fingerprint of the scanned document for Nachvollziehbarkeit.
  const documentRef = createHash("sha256").update(bytes).digest("hex");

  // ── AI extraction (mock-able, failover) ──────────────────────────
  let extraction;
  try {
    extraction = await extractTimesheet({ base64, mimeType: file.type });
  } catch {
    // extractTimesheet already logged PII-free failure details.
    return serverError("Timesheet extraction failed. Please try again.");
  }

  // ── Resolve each row's identity against ACTIVE workspace employees ──
  // Identity priority: per-row name (multi-employee rosters) → document
  // header. Match by Personal-Nr. (datevPersonnelNumber) first, then name.
  const { employee: header, rows } = extraction;
  return withWorkspaceContext(workspaceId, async (tx) => {
    const employees = await tx.employee.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        datevPersonnelNumber: true,
      },
    });

    // Lookups: name ("First Last" + "Last First") and personnel number.
    const byName = new Map<string, string>();
    const byPnr = new Map<string, string>();
    for (const e of employees) {
      byName.set(normalizeName(`${e.firstName} ${e.lastName}`), e.id);
      byName.set(normalizeName(`${e.lastName} ${e.firstName}`), e.id);
      if (e.datevPersonnelNumber) {
        byPnr.set(normalizePnr(e.datevPersonnelNumber), e.id);
      }
    }

    const headerName = header.name?.trim() || null;
    const headerPnr = header.personnelNumber?.trim() || null;

    const matched: Array<{ row: ExtractedRow; employeeId: string }> = [];
    const missingSet = new Set<string>();

    for (const row of rows) {
      // Per-row name overrides the header (multi-employee sheets); otherwise
      // the whole sheet belongs to the header employee.
      const rowName = row.employeeName?.trim() || null;
      const identityName = rowName ?? headerName;
      // Personnel number only applies to the header identity.
      const identityPnr = rowName ? null : headerPnr;

      const employeeId =
        (identityPnr ? byPnr.get(normalizePnr(identityPnr)) : undefined) ??
        (identityName ? byName.get(normalizeName(identityName)) : undefined);

      if (employeeId) {
        matched.push({ row, employeeId });
      } else {
        // Block unknown people; surface the on-document label so the manager
        // can invite them. Not new PII — it is on the sheet.
        const label =
          identityName ??
          (identityPnr ? `Personal-Nr. ${identityPnr}` : "Unbekannt");
        missingSet.add(label);
      }
    }
    const missingEmployees = [...missingSet];

    // ── Stage as PENDING_REVIEW with audit trail ───────────────────
    const created = await tx.timesheetImport.create({
      data: {
        workspaceId,
        source: extraction.source,
        documentRef,
        missingEmployees: JSON.stringify(missingEmployees),
        importedByUserId: user.id,
        entries: {
          create: matched.map(({ row, employeeId }) => ({
            workspaceId,
            employeeId,
            date: new Date(`${row.date}T00:00:00.000Z`),
            startTime: row.shiftStart,
            endTime: row.shiftEnd,
            breakMinutes: row.breakMinutes,
            // Overall row confidence folds in the identity (header) confidence
            // for header-named rows so an unclear name surfaces in the % shown.
            confidence: Math.min(
              row.employeeName ? 1 : header.confidence,
              row.confidenceScores.date,
              row.confidenceScores.shiftStart,
              row.confidenceScores.shiftEnd,
            ),
            confidenceScores: JSON.stringify(row.confidenceScores),
          })),
        },
      },
      include: {
        entries: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        },
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "TimesheetImport",
      entityId: created.id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId,
      // Counts only — no names/hours.
      metadata: {
        source: extraction.source,
        entryCount: created.entries.length,
        missingCount: missingEmployees.length,
        documentRef,
      },
    });

    log.info("timesheet.ocr.staged", {
      importId: created.id,
      source: extraction.source,
      entries: created.entries.length,
      missing: missingEmployees.length,
    });

    return NextResponse.json(
      {
        importId: created.id,
        status: created.status,
        source: created.source,
        missingEmployees,
        entries: created.entries.map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
          date: e.date.toISOString().slice(0, 10),
          shiftStart: e.startTime,
          shiftEnd: e.endTime,
          breakMinutes: e.breakMinutes,
          confidence: e.confidence,
          confidenceScores: JSON.parse(e.confidenceScores) as Record<
            string,
            number
          >,
        })),
      },
      { status: 201 },
    );
  }).catch((err) => {
    captureRouteError(err, {
      route: "/api/timesheet/ocr",
      method: "POST",
      userId: user.id,
      workspaceId,
    });
    return serverError("Failed to stage timesheet import");
  });
});
