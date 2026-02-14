import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  calcGrossMinutes,
  calcBreakMinutes,
  calcNetMinutes,
} from "@/lib/time-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET  /api/time-entries/:id ─────────────────────────────────
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as SessionUser).workspaceId;

    const entry = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
      include: {
        employee: true,
        location: true,
        auditLog: { orderBy: { performedAt: "desc" } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error fetching time entry:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// ─── PATCH  /api/time-entries/:id ───────────────────────────────
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
    });

    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Only ENTWURF or KORREKTUR can be edited
    if (!["ENTWURF", "KORREKTUR"].includes(existing.status)) {
      return NextResponse.json(
        {
          error:
            "Nur Einträge im Entwurf oder Korrekturstatus können bearbeitet werden",
        },
        { status: 400 },
      );
    }

    const body = await req.json();

    // Build changes diff for audit
    const changedFields: Record<string, { old: unknown; new: unknown }> = {};
    const editableFields = [
      "startTime",
      "endTime",
      "breakStart",
      "breakEnd",
      "breakMinutes",
      "remarks",
      "locationId",
      "date",
    ] as const;

    for (const field of editableFields) {
      if (
        body[field] !== undefined &&
        body[field] !== (existing as Record<string, unknown>)[field]
      ) {
        changedFields[field] = {
          old: (existing as Record<string, unknown>)[field],
          new: body[field],
        };
      }
    }

    // Recalculate durations
    const startTime = body.startTime ?? existing.startTime;
    const endTime = body.endTime ?? existing.endTime;
    const grossMinutes = calcGrossMinutes(startTime, endTime);
    const breakMins = calcBreakMinutes(
      body.breakStart ?? existing.breakStart,
      body.breakEnd ?? existing.breakEnd,
      body.breakMinutes ?? existing.breakMinutes,
    );
    const netMinutes = calcNetMinutes(grossMinutes, breakMins);

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        startTime,
        endTime,
        breakStart: body.breakStart ?? existing.breakStart,
        breakEnd: body.breakEnd ?? existing.breakEnd,
        breakMinutes: breakMins,
        grossMinutes,
        netMinutes,
        remarks: body.remarks ?? existing.remarks,
        locationId: body.locationId ?? existing.locationId,
        date: body.date ? new Date(body.date) : existing.date,
      },
      include: { employee: true, location: true },
    });

    // Audit log
    if (Object.keys(changedFields).length > 0) {
      await prisma.timeEntryAudit.create({
        data: {
          action: "EDITED",
          changes: JSON.stringify(changedFields),
          performedBy: user.id,
          timeEntryId: id,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating time entry:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 },
    );
  }
}

// ─── DELETE  /api/time-entries/:id ──────────────────────────────
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as SessionUser).workspaceId;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
    });

    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Only drafts can be deleted
    if (existing.status !== "ENTWURF") {
      return NextResponse.json(
        { error: "Nur Entwürfe können gelöscht werden" },
        { status: 400 },
      );
    }

    await prisma.timeEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting time entry:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
