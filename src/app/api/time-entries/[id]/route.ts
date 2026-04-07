import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isEmployee } from "@/lib/authorization";
import {
  calcGrossMinutes,
  calcBreakMinutes,
  calcNetMinutes,
} from "@/lib/time-utils";
import { log } from "@/lib/logger";
import { updateTimeEntrySchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET  /api/time-entries/:id ─────────────────────────────────
export const GET = withRoute(
  "/api/time-entries/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only view their own time entries
    const user = session.user as SessionUser;
    if (
      isEmployee(user) &&
      user.employeeId &&
      entry.employeeId !== user.employeeId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(entry);
  },
);

// ─── PATCH  /api/time-entries/:id ───────────────────────────────
export const PATCH = withRoute(
  "/api/time-entries/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only edit their own time entries
    if (
      isEmployee(user) &&
      user.employeeId &&
      existing.employeeId !== user.employeeId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const parsed = validateBody(updateTimeEntrySchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

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

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.timeEntry.update({
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

      // Audit log (atomic)
      if (Object.keys(changedFields).length > 0) {
        await tx.timeEntryAudit.create({
          data: {
            action: "EDITED",
            changes: JSON.stringify(changedFields),
            performedBy: user.id,
            timeEntryId: id,
          },
        });
      }

      return result;
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "TimeEntry",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspaceId!,
      changes: changedFields,
    });

    dispatchWebhook(workspaceId!, "time_entry.updated", {
      id,
      ...changedFields,
    }).catch(() => {});

    return NextResponse.json(updated);
  },
);

// ─── DELETE  /api/time-entries/:id ──────────────────────────────
export const DELETE = withRoute(
  "/api/time-entries/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const workspaceId = (session.user as SessionUser).workspaceId;
    const currentUser = session.user as SessionUser;

    const existing = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only delete their own time entries
    if (
      isEmployee(currentUser) &&
      currentUser.employeeId &&
      existing.employeeId !== currentUser.employeeId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only drafts can be deleted
    if (existing.status !== "ENTWURF") {
      return NextResponse.json(
        { error: "Only drafts can be deleted" },
        { status: 400 },
      );
    }

    await prisma.timeEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "TimeEntry",
      entityId: id,
      userId: currentUser.id,
      userEmail: currentUser.email,
      workspaceId: workspaceId!,
    });

    dispatchWebhook(workspaceId!, "time_entry.deleted", { id }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
