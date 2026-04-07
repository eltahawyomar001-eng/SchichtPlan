import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee } from "@/lib/authorization";
import { createSystemNotification } from "@/lib/automations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import {
  createShiftChangeRequestSchema,
  validateBody,
} from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

// ─── GET  /api/shift-change-requests ────────────────────────────
// Management sees all requests for the workspace.
// Employees see only their own requests.
export const GET = withRoute(
  "/api/shift-change-requests",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;

    // Employees can only see their own requests
    if (isEmployee(user)) {
      const linkedEmployee = await prisma.employee.findFirst({
        where: { workspaceId, email: user.email ?? undefined },
      });
      if (linkedEmployee) {
        where.requesterId = linkedEmployee.id;
      } else {
        return NextResponse.json({
          data: [],
          pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
        });
      }
    }

    const { take, skip } = parsePagination(req);

    const [requests, total] = await Promise.all([
      prisma.shiftChangeRequest.findMany({
        where,
        include: {
          shift: {
            include: {
              employee: true,
              location: true,
            },
          },
          requester: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.shiftChangeRequest.count({ where }),
    ]);

    return paginatedResponse(requests, total, take, skip);
  },
);

// ─── POST  /api/shift-change-requests ───────────────────────────
// An employee requests a change to one of their shifts.
export const POST = withRoute(
  "/api/shift-change-requests",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const parsed = validateBody(
      createShiftChangeRequestSchema,
      await req.json(),
    );
    if (!parsed.success) return parsed.response;
    const { shiftId, newDate, newStartTime, newEndTime, newNotes, reason } =
      parsed.data;

    // Verify the shift exists and belongs to this workspace
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, workspaceId },
      include: { employee: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Find the linked employee for the current user
    const linkedEmployee = await prisma.employee.findFirst({
      where: { workspaceId, email: user.email ?? undefined },
    });

    if (!linkedEmployee) {
      return NextResponse.json(
        { error: "No linked employee profile found" },
        { status: 400 },
      );
    }

    // Employee can only request changes for their own shifts
    if (isEmployee(user) && shift.employeeId !== linkedEmployee.id) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message:
            "Sie können nur Änderungen für Ihre eigenen Schichten anfragen.",
        },
        { status: 403 },
      );
    }

    // Check for duplicate pending requests on the same shift
    const existingRequest = await prisma.shiftChangeRequest.findFirst({
      where: {
        shiftId,
        requesterId: linkedEmployee.id,
        status: "AUSSTEHEND",
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: "Duplicate request",
          message:
            "Es gibt bereits eine offene Änderungsanfrage für diese Schicht.",
        },
        { status: 409 },
      );
    }

    const changeRequest = await prisma.shiftChangeRequest.create({
      data: {
        shiftId,
        requesterId: linkedEmployee.id,
        newDate: newDate ? new Date(newDate) : null,
        newStartTime: newStartTime || null,
        newEndTime: newEndTime || null,
        newNotes: newNotes ?? null,
        reason: reason || null,
        workspaceId,
      },
      include: {
        shift: { include: { employee: true, location: true } },
        requester: true,
      },
    });

    // Notify managers/owners about the new request
    try {
      await createSystemNotification({
        type: "SHIFT_CHANGE_REQUESTED",
        title: "Neue Schichtänderungsanfrage",
        message: `${linkedEmployee.firstName} ${linkedEmployee.lastName} hat eine Änderung für die Schicht am ${shift.date.toISOString().split("T")[0]} angefragt.`,
        link: "/schichtplan?tab=requests",
        workspaceId,
        recipientType: "managers",
      });
    } catch {
      // Don't fail the request if notifications fail
      log.error("Failed to send notification for shift change request");
    }

    createAuditLog({
      action: "CREATE",
      entityType: "ShiftChangeRequest",
      entityId: changeRequest.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { shiftId, newDate, newStartTime, newEndTime },
    });

    dispatchWebhook(workspaceId, "shift_change.requested", {
      id: changeRequest.id,
      shiftId,
    }).catch(() => {});

    return NextResponse.json(changeRequest, { status: 201 });
  },
  { idempotent: true },
);
