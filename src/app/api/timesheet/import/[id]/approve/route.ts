/* ─────────────────────────────────────────────────────────────────
   POST /api/timesheet/import/[id]/approve
   ─────────────────────────────────────────────────────────────────
   The "Confirm & Submit" mutation behind the mandatory Review & Edit
   screen. Accepts the manager-verified (possibly edited) entries, applies
   the edits to the staged rows, and ATOMICALLY promotes each into a real
   `Shift`. This is the ONLY path that moves imported data into active
   schedules — nothing is merged without this explicit approval.

   Tenant-scoped and management-gated. Idempotent-ish: an already-APPROVED
   import is rejected (409) so a double submit cannot create duplicate shifts.
   ───────────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { withWorkspaceContext } from "@/lib/db";
import {
  requireAuth,
  notFound,
  conflict,
  badRequest,
  serverError,
} from "@/lib/api-response";
import { requireManagement } from "@/lib/authorization";
import {
  evaluateShiftCompliance,
  type ComplianceViolation,
} from "@/lib/compliance-gate";
import { createAuditLog } from "@/lib/audit";
import { captureRouteError } from "@/lib/sentry";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const ApproveBodySchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().min(1),
        // The manager's confirmed employee assignment for this row.
        employeeId: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
        shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
        breakMinutes: z.number().int().min(0).max(600),
      }),
    )
    .min(1),
});

export const POST = withRoute(
  "/api/timesheet/import/[id]/approve",
  "POST",
  async (req, context) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const gate = requireManagement(user);
    if (gate) return gate;

    const { id } = await context!.params;

    let body: z.infer<typeof ApproveBodySchema>;
    try {
      body = ApproveBodySchema.parse(await req.json());
    } catch {
      return badRequest("Invalid approval payload");
    }

    /* ── Compliance gate (§34a + ArbZG §3/§4/§5) ──────────────────
       OCR import used to be a hole in the guarantee: approved rows were
       written straight into `Shift` with no checks, so a scanned timesheet
       could materialise shifts that the shift API would have refused.

       Checked BEFORE the transaction, for two reasons: the checks read
       committed state and would not see rows created earlier in the same
       transaction, and a long-running transaction around per-row queries is
       needlessly expensive. Approval is all-or-nothing — a partially imported
       sheet is worse than a rejected one, because the manager cannot tell
       which rows landed.                                                    */
    const batchViolations: {
      entryId: string;
      violations: ComplianceViolation[];
    }[] = [];

    // Intra-batch §3: two rows for the same employee on the same day are each
    // lawful alone but may breach 10h together. The per-row check reads only
    // committed shifts, so the batch's own totals are accumulated here.
    const batchMinutesByEmployeeDay = new Map<string, number>();
    for (const e of body.entries) {
      const [sh, sm] = e.shiftStart.split(":").map(Number);
      const [eh, em] = e.shiftEnd.split(":").map(Number);
      let gross = eh * 60 + em - (sh * 60 + sm);
      if (gross <= 0) gross += 24 * 60; // overnight
      const net = Math.max(0, gross - e.breakMinutes);
      const key = `${e.employeeId}:${e.date}`;
      batchMinutesByEmployeeDay.set(
        key,
        (batchMinutesByEmployeeDay.get(key) ?? 0) + net,
      );
    }

    for (const e of body.entries) {
      const violations = await evaluateShiftCompliance(
        {
          employeeId: e.employeeId,
          locationId: null,
          date: e.date,
          startTime: e.shiftStart,
          endTime: e.shiftEnd,
          breakMinutes: e.breakMinutes,
        },
        workspaceId,
      );
      if (violations.length > 0) {
        batchViolations.push({ entryId: e.id, violations });
      }
    }

    for (const [key, minutes] of batchMinutesByEmployeeDay) {
      if (minutes > 600) {
        const [, day] = key.split(":");
        const already = batchViolations.some((b) =>
          b.violations.some((v) => v.rule === "ARBZG_3"),
        );
        if (!already) {
          batchViolations.push({
            entryId: key,
            violations: [
              {
                rule: "ARBZG_3",
                code: "ARBZG_3_OVER_DAILY_MAX_IN_BATCH",
                message:
                  `ArbZG §3: Die importierten Zeilen ergeben für den ${day} zusammen ` +
                  `${Math.floor(minutes / 60)}h ${minutes % 60}min Arbeitszeit und ` +
                  `überschreiten damit die zulässigen 10 Stunden.`,
                messageEn:
                  `ArbZG §3: the imported rows total ${Math.floor(minutes / 60)}h ` +
                  `${minutes % 60}min of working time on ${day}, exceeding the 10-hour limit.`,
                details: { totalMinutes: minutes, maxMinutes: 600 },
              },
            ],
          });
        }
      }
    }

    if (batchViolations.length > 0) {
      return NextResponse.json(
        {
          error: "COMPLIANCE_VIOLATION",
          message:
            "Der Import kann nicht übernommen werden — mindestens eine Zeile " +
            "verletzt geltendes Arbeitsrecht oder die §34a-Pflicht.",
          entries: batchViolations,
        },
        { status: 422 },
      );
    }

    try {
      const result = await withWorkspaceContext(workspaceId, async (tx) => {
        const imp = await tx.timesheetImport.findFirst({
          where: { id, workspaceId },
          include: { entries: true },
        });
        if (!imp) return { kind: "not_found" as const };
        if (imp.status !== "PENDING_REVIEW") {
          return { kind: "conflict" as const };
        }

        // Map edits by entry id and confirm every edit targets THIS import.
        const editById = new Map(body.entries.map((e) => [e.id, e]));
        const stagedIds = new Set(imp.entries.map((e) => e.id));
        for (const editId of editById.keys()) {
          if (!stagedIds.has(editId)) return { kind: "bad_entry" as const };
        }

        // Every assigned employee must be an active member of THIS workspace
        // (a manager could otherwise be tricked into assigning a foreign id).
        const validEmployees = await tx.employee.findMany({
          where: {
            workspaceId,
            isActive: true,
            deletedAt: null,
            id: { in: [...new Set(body.entries.map((e) => e.employeeId))] },
          },
          select: { id: true },
        });
        const validIds = new Set(validEmployees.map((e) => e.id));
        for (const e of body.entries) {
          if (!validIds.has(e.employeeId))
            return { kind: "bad_employee" as const };
        }

        let materialized = 0;
        for (const entry of imp.entries) {
          const edit = editById.get(entry.id);
          // Only rows the manager explicitly confirmed (with an assigned
          // employee) become shifts; unassigned rows are left in staging.
          if (!edit) continue;

          const date = new Date(`${edit.date}T00:00:00.000Z`);

          const shift = await tx.shift.create({
            data: {
              workspaceId,
              employeeId: edit.employeeId,
              date,
              startTime: edit.shiftStart,
              endTime: edit.shiftEnd,
              breakMinutes: edit.breakMinutes,
              notes: `Importiert aus Stundenzettel (${imp.id})`,
            },
            select: { id: true },
          });

          await tx.timesheetImportEntry.update({
            where: { id: entry.id },
            data: {
              employeeId: edit.employeeId,
              date,
              startTime: edit.shiftStart,
              endTime: edit.shiftEnd,
              breakMinutes: edit.breakMinutes,
              status: "APPROVED",
              materializedShiftId: shift.id,
            },
          });
          materialized++;
        }

        await tx.timesheetImport.update({
          where: { id: imp.id },
          data: {
            status: "APPROVED",
            reviewedByUserId: user.id,
            reviewedAt: new Date(),
          },
        });

        return { kind: "ok" as const, materialized };
      });

      if (result.kind === "not_found") return notFound("Import not found");
      if (result.kind === "conflict") {
        return conflict("This import has already been processed");
      }
      if (result.kind === "bad_entry") {
        return badRequest("An entry does not belong to this import");
      }
      if (result.kind === "bad_employee") {
        return badRequest("An assigned employee is not in this workspace");
      }

      createAuditLog({
        action: "APPROVE",
        entityType: "TimesheetImport",
        entityId: id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId,
        metadata: { materializedShifts: result.materialized },
      });
      log.info("timesheet.import.approved", {
        importId: id,
        shifts: result.materialized,
      });

      return NextResponse.json({
        ok: true,
        materializedShifts: result.materialized,
      });
    } catch (err) {
      captureRouteError(err, {
        route: "/api/timesheet/import/[id]/approve",
        method: "POST",
        userId: user.id,
        workspaceId,
      });
      return serverError("Failed to approve timesheet import");
    }
  },
);
