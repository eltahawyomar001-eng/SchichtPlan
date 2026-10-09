/**
 * Confirm or remove one recorded break.
 *
 * Confirming is the act the spec hinges on: "Eine nachträgliche Pausenbuchung
 * soll nur erfolgen, wenn bestätigt wurde, dass die Pause tatsächlich genommen
 * wurde." Until this runs, the row exists but counts for nothing -- the
 * assessment ignores unconfirmed breaks, so a §4 shortfall cannot be made to
 * vanish simply by typing a break into the record.
 *
 * Confirmation is therefore recorded as an attributable act: who said the break
 * happened, and when they said it.
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
import { requireSessionWorkspace } from "@/lib/require-workspace";

const patchSchema = z.object({
  confirmed: z.boolean(),
});

export const PATCH = withRoute(
  "/api/time-entries/[id]/breaks/[breakId]",
  "PATCH",
  async (req, context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    // A session without a workspace must be refused, never queried across
    // every tenant. See require-workspace.ts.
    const ws = requireSessionWorkspace(user);
    if (!ws.ok) return ws.response;
    const workspaceId = ws.workspaceId;
    const params = (await context!.params) as {
      id: string;
      breakId: string;
    };

    // Confirming that somebody else's break was taken is a manager's statement
    // about a fact they are accountable for. An employee confirming their own
    // would make the control meaningless.
    if (isEmployee(user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const json = await parseJsonBody(req);
    if (!json.ok) return json.response;
    const parsed = validateBody(patchSchema, json.data);
    if (!parsed.success) return parsed.response;

    const existing = await prisma.timeEntryBreak.findFirst({
      where: {
        id: params.breakId,
        timeEntryId: params.id,
        workspaceId,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.timeEntryBreak.update({
        where: { id: params.breakId },
        data: parsed.data.confirmed
          ? { confirmed: true, confirmedBy: user.id, confirmedAt: new Date() }
          : // Withdrawing a confirmation clears who vouched for it. Leaving the
            // old name attached would keep crediting somebody for a statement
            // that has been taken back.
            { confirmed: false, confirmedBy: null, confirmedAt: null },
      });

      await tx.timeEntryAudit.create({
        data: {
          action: parsed.data.confirmed
            ? "BREAK_CONFIRMED"
            : "BREAK_UNCONFIRMED",
          changes: JSON.stringify({
            confirmed: { old: existing.confirmed, new: parsed.data.confirmed },
            startOffsetMinutes: existing.startOffsetMinutes,
            endOffsetMinutes: existing.endOffsetMinutes,
          }),
          comment: parsed.data.confirmed
            ? "Pause als tatsächlich genommen bestätigt"
            : "Bestätigung der Pause zurückgenommen",
          performedBy: user.id,
          timeEntryId: params.id,
        },
      });

      return row;
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withRoute(
  "/api/time-entries/[id]/breaks/[breakId]",
  "DELETE",
  async (_req, context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    // A session without a workspace must be refused, never queried across
    // every tenant. See require-workspace.ts.
    const ws = requireSessionWorkspace(user);
    if (!ws.ok) return ws.response;
    const workspaceId = ws.workspaceId;
    const params = (await context!.params) as { id: string; breakId: string };

    if (isEmployee(user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = await prisma.timeEntryBreak.findFirst({
      where: {
        id: params.breakId,
        timeEntryId: params.id,
        workspaceId,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.timeEntryBreak.delete({ where: { id: params.breakId } });
      // The row goes, the record of it does not: removing rest from somebody's
      // day is exactly the kind of change that has to stay accountable.
      await tx.timeEntryAudit.create({
        data: {
          action: "BREAK_REMOVED",
          changes: JSON.stringify({
            startOffsetMinutes: existing.startOffsetMinutes,
            endOffsetMinutes: existing.endOffsetMinutes,
            confirmed: existing.confirmed,
          }),
          performedBy: user.id,
          timeEntryId: params.id,
        },
      });
    });

    return NextResponse.json({ success: true });
  },
);
