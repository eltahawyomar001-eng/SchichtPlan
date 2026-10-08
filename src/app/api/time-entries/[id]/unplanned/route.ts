import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

const schema = z.object({
  decision: z.enum(["GENEHMIGT", "ABGELEHNT", "OFFEN"]),
  /**
   * Mandatory for an actual decision.
   *
   * An approval nobody can account for later is worth very little: the whole
   * point of recording the deviation is that somebody can say, months on, why
   * these hours were accepted. "Weil der Chef es gesagt hat" written down
   * beats the same thing remembered.
   */
  reason: z.string().trim().max(1000).optional(),
});

/**
 * PATCH /api/time-entries/[id]/unplanned
 *
 * Approve or reject an attendance that deviated from the roster.
 *
 * The deviation itself is never written down -- it is derived from the shift
 * plan, which can still change. What is stored is this decision, which is a
 * fact about a person and a moment and has to outlive any later edit to the
 * plan.
 */
export const PATCH = withRoute(
  "/api/time-entries/[id]/unplanned",
  "PATCH",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Approving someone else's hours is an approval, not an edit.
    const forbidden = requirePermission(user, "time-entries", "approve");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = schema.safeParse(_json.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const { decision, reason } = parsed.data;

    if (decision !== "OFFEN" && !reason) {
      return NextResponse.json(
        {
          error: "REASON_REQUIRED",
          message:
            "Bitte hinterlegen Sie eine Begründung. Sie wird zusammen mit der Entscheidung dauerhaft gespeichert.",
        },
        { status: 400 },
      );
    }

    const existing = await prisma.timeEntry.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: {
        id: true,
        employeeId: true,
        date: true,
        unplannedDecision: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        unplannedDecision: decision,
        unplannedReason: reason ?? null,
        // Reopening clears the decider, so the record never shows somebody as
        // having decided something that is once again undecided.
        unplannedDecidedBy: decision === "OFFEN" ? null : user.id,
        unplannedDecidedAt: decision === "OFFEN" ? null : new Date(),
      },
      select: {
        id: true,
        unplannedDecision: true,
        unplannedReason: true,
        unplannedDecidedAt: true,
      },
    });

    createAuditLog({
      action: decision === "GENEHMIGT" ? "APPROVE" : "REJECT",
      entityType: "TimeEntry",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: {
        unplannedDecision: decision,
        reason: reason ?? null,
        previous: existing.unplannedDecision,
      },
    });

    return NextResponse.json(updated);
  },
);
