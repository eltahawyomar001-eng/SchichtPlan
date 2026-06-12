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
import { createAuditLog } from "@/lib/audit";
import { captureRouteError } from "@/lib/sentry";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const ApproveBodySchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().min(1),
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

        let materialized = 0;
        for (const entry of imp.entries) {
          const edit = editById.get(entry.id);
          // If the manager didn't include a staged entry, skip it (treat as
          // unresolved — only explicitly confirmed rows become shifts).
          if (!edit) continue;

          const date = new Date(`${edit.date}T00:00:00.000Z`);

          const shift = await tx.shift.create({
            data: {
              workspaceId,
              employeeId: entry.employeeId,
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
