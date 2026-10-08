/**
 * PATCH /api/time-entries/:id/lateness-reason
 *
 * The employee's explanation for arriving late, recorded separately from the
 * clock-out on purpose.
 *
 * The stamped end of a shift is a fact about when somebody stopped working and
 * is written the moment they press the button. Making it conditional on a text
 * box being filled in would mean a dead battery, a dismissed dialog or a
 * fumbled sentence could cost somebody their recorded hours. So the clock-out
 * lands first and this follows, which also means the entry can legitimately sit
 * in the "Begründung der Verspätung fehlt" state for a while.
 *
 * It does not touch any recorded time. This is an annotation on a shift, and
 * the stamped times stay exactly as they were captured.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isEmployee } from "@/lib/authorization";
import { parseJsonBody } from "@/lib/api-response";
import { validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";

const schema = z.object({
  /**
   * Long enough to be an explanation. A single character satisfies a required
   * field without telling the employer anything, which is the failure mode
   * worth designing against here.
   */
  reason: z.string().trim().min(3).max(1000),
});

export const PATCH = withRoute(
  "/api/time-entries/[id]/lateness-reason",
  "PATCH",
  async (req, context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await context!.params;

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = validateBody(schema, body.data);
    if (!parsed.success) return parsed.response;

    const entry = await prisma.timeEntry.findFirst({
      where: {
        id,
        workspaceId: user.workspaceId ?? undefined,
        deletedAt: null,
      },
      select: { id: true, employeeId: true, latenessReason: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // An employee may explain their own lateness and nobody else's: the note
    // is attributed to them and shown to the employer as their statement.
    if (isEmployee(user) && entry.employeeId !== user.employeeId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.timeEntry.update({
        where: { id },
        data: {
          latenessReason: parsed.data.reason,
          latenessReasonAt: new Date(),
          latenessReasonBy: user.id,
        },
        select: {
          id: true,
          latenessReason: true,
          latenessReasonAt: true,
          latenessReasonBy: true,
        },
      });

      // Replacing an existing explanation is a change to the record an
      // employer may already have read, so both versions are kept.
      await tx.timeEntryAudit.create({
        data: {
          action: entry.latenessReason
            ? "LATENESS_REASON_CHANGED"
            : "LATENESS_REASON_ADDED",
          changes: JSON.stringify({
            latenessReason: {
              old: entry.latenessReason,
              new: parsed.data.reason,
            },
          }),
          performedBy: user.id,
          timeEntryId: id,
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  },
);
