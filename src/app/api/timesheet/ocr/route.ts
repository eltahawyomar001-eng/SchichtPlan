/* ─────────────────────────────────────────────────────────────────
   POST /api/timesheet/ocr
   ─────────────────────────────────────────────────────────────────
   Shared endpoint for BOTH web (drag-drop) and mobile (camera) uploads.
   Accepts a multipart/form-data image + workspace_id, runs server-side
   AI vision extraction (mock-able, with Anthropic→OpenAI failover),
   resolves the employee, and STAGES every row as PENDING_REVIEW.

   Matching is best-effort: Personal-Nr. → exact name → fuzzy suggestion.
   Rows that don't confidently match are still staged (employeeId = null)
   so the manager can ASSIGN the right employee on the Review screen —
   instead of being forced to invite someone who already exists.

   Privacy / Datenschutz: server-side only, image processed in memory (no
   temp file), only a SHA-256 documentRef retained, no PII logged, tenant
   isolation enforced (authenticated workspace wins).
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
import { extractTimesheet } from "@/lib/ai/timesheet-vision";
import { buildEmployeeIndex, matchIdentity } from "@/lib/timesheet-match";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
    return serverError("Timesheet extraction failed. Please try again.");
  }

  const { employee: header, rows } = extraction;
  const headerName = header.name?.trim() || null;
  const headerPnr = header.personnelNumber?.trim() || null;

  return withWorkspaceContext(workspaceId, async (tx) => {
    const employees = await tx.employee.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        datevPersonnelNumber: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    const index = buildEmployeeIndex(employees);
    const nameById = new Map(
      employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
    );

    // Resolve each row's identity. Per-row name (multi-employee rosters)
    // overrides the document header; Personal-Nr. only applies to the header.
    const prepared = rows.map((row) => {
      const rowName = row.employeeName?.trim() || null;
      const identityName = rowName ?? headerName;
      const identityPnr = rowName ? null : headerPnr;
      const match = matchIdentity(
        { name: identityName, personnelNumber: identityPnr },
        index,
      );
      const extractedName =
        identityName ?? (identityPnr ? `Personal-Nr. ${identityPnr}` : null);
      const confidence = Math.min(
        rowName ? 1 : header.confidence,
        row.confidenceScores.date,
        row.confidenceScores.shiftStart,
        row.confidenceScores.shiftEnd,
      );
      return { row, match, extractedName, confidence };
    });

    // Genuinely unknown names (no match AND no fuzzy suggestion) → invite hint.
    const missingEmployees = [
      ...new Set(
        prepared
          .filter((p) => p.match.kind === "unmatched" && p.extractedName)
          .map((p) => p.extractedName as string),
      ),
    ];

    // ── Stage as PENDING_REVIEW with audit trail ───────────────────
    const created = await tx.timesheetImport.create({
      data: {
        workspaceId,
        source: extraction.source,
        documentRef,
        missingEmployees: JSON.stringify(missingEmployees),
        importedByUserId: user.id,
      },
      select: { id: true, status: true, source: true },
    });

    // createManyAndReturn preserves input order → safe to zip with `prepared`.
    const createdEntries = await tx.timesheetImportEntry.createManyAndReturn({
      data: prepared.map((p) => ({
        importId: created.id,
        workspaceId,
        employeeId: p.match.employeeId,
        extractedName: p.extractedName,
        date: new Date(`${p.row.date}T00:00:00.000Z`),
        startTime: p.row.shiftStart,
        endTime: p.row.shiftEnd,
        breakMinutes: p.row.breakMinutes,
        confidence: p.confidence,
        confidenceScores: JSON.stringify(p.row.confidenceScores),
      })),
      select: {
        id: true,
        employeeId: true,
        extractedName: true,
        date: true,
        startTime: true,
        endTime: true,
        breakMinutes: true,
        confidence: true,
        confidenceScores: true,
      },
    });

    const matchedCount = prepared.filter((p) => p.match.employeeId).length;

    createAuditLog({
      action: "CREATE",
      entityType: "TimesheetImport",
      entityId: created.id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId,
      metadata: {
        source: extraction.source,
        entryCount: createdEntries.length,
        matchedCount,
        missingCount: missingEmployees.length,
        documentRef,
      },
    });

    log.info("timesheet.ocr.staged", {
      importId: created.id,
      source: extraction.source,
      entries: createdEntries.length,
      matched: matchedCount,
      missing: missingEmployees.length,
    });

    const entries = createdEntries.map((e, i) => {
      const sug = prepared[i].match.suggestedEmployeeId;
      return {
        id: e.id,
        employeeId: e.employeeId,
        employeeName: e.employeeId
          ? (nameById.get(e.employeeId) ?? null)
          : null,
        extractedName: e.extractedName,
        suggestedEmployeeId: sug,
        suggestedEmployeeName: sug ? (nameById.get(sug) ?? null) : null,
        matchKind: prepared[i].match.kind,
        date: e.date.toISOString().slice(0, 10),
        shiftStart: e.startTime,
        shiftEnd: e.endTime,
        breakMinutes: e.breakMinutes,
        confidence: e.confidence,
        confidenceScores: JSON.parse(e.confidenceScores) as Record<
          string,
          number
        >,
      };
    });

    return NextResponse.json(
      {
        importId: created.id,
        status: created.status,
        source: created.source,
        missingEmployees,
        // Options for the Review-screen employee picker.
        workspaceEmployees: employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
        })),
        entries,
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
