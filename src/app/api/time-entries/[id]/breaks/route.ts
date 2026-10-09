/**
 * Breaks on one time entry.
 *
 * POST adds a break a manager is entering after the fact. GET lists them.
 *
 * The rule the spec is strict about, and the reason this endpoint exists at
 * all: a retroactively booked break may only count once somebody has confirmed
 * it was genuinely taken. Otherwise the §4 shortfall this system is designed to
 * surface could be made to disappear by typing a break into the record, which
 * is precisely the fraud the law is written against. So a manager-entered row
 * arrives unconfirmed and stays inert until it is confirmed deliberately.
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

const createSchema = z.object({
  /** Minutes after clock-in. */
  startOffsetMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  endOffsetMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  /**
   * Whether the break is being recorded as genuinely taken.
   *
   * A manager may confirm in the same step, but it is an explicit act rather
   * than a default: the whole point is that somebody states the break happened.
   */
  confirmed: z.boolean().optional().default(false),
});

export const GET = withRoute(
  "/api/time-entries/[id]/breaks",
  "GET",
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
    const { id } = await context!.params;

    const entry = await prisma.timeEntry.findFirst({
      where: { id, workspaceId },
      select: { id: true, employeeId: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (isEmployee(user) && entry.employeeId !== user.employeeId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const breaks = await prisma.timeEntryBreak.findMany({
      where: { timeEntryId: id },
      orderBy: { startOffsetMinutes: "asc" },
    });
    return NextResponse.json(breaks);
  },
);

export const POST = withRoute(
  "/api/time-entries/[id]/breaks",
  "POST",
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
    const { id } = await context!.params;

    // Only a manager books a break onto somebody's day. An employee adding
    // their own after the fact is the exact move this is meant to prevent.
    if (isEmployee(user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const json = await parseJsonBody(req);
    if (!json.ok) return json.response;
    const parsed = validateBody(createSchema, json.data);
    if (!parsed.success) return parsed.response;
    const { startOffsetMinutes, endOffsetMinutes, confirmed } = parsed.data;

    if (endOffsetMinutes <= startOffsetMinutes) {
      return NextResponse.json(
        {
          error: "INVALID_RANGE",
          message: "Das Pausenende muss nach dem Pausenbeginn liegen.",
        },
        { status: 400 },
      );
    }

    const entry = await prisma.timeEntry.findFirst({
      where: { id, workspaceId },
      select: { id: true, workspaceId: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.timeEntryBreak.create({
        data: {
          timeEntryId: id,
          workspaceId: entry.workspaceId,
          startOffsetMinutes,
          endOffsetMinutes,
          source: "KORREKTUR",
          confirmed,
          ...(confirmed
            ? { confirmedBy: user.id, confirmedAt: new Date() }
            : {}),
        },
      });

      await tx.timeEntryAudit.create({
        data: {
          action: "BREAK_ADDED",
          changes: JSON.stringify({
            startOffsetMinutes,
            endOffsetMinutes,
            confirmed,
          }),
          comment: confirmed
            ? "Nachträgliche Pause als tatsächlich genommen bestätigt"
            : "Nachträgliche Pause erfasst, noch nicht bestätigt",
          performedBy: user.id,
          timeEntryId: id,
        },
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  },
);
