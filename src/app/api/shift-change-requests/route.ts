import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isEmployee, isManagement } from "@/lib/authorization";
import { createSystemNotification } from "@/lib/automations";

// ─── GET  /api/shift-change-requests ────────────────────────────
// Management sees all requests for the workspace.
// Employees see only their own requests.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
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
        return NextResponse.json([]);
      }
    }

    const requests = await prisma.shiftChangeRequest.findMany({
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
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching shift change requests:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── POST  /api/shift-change-requests ───────────────────────────
// An employee requests a change to one of their shifts.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const body = await req.json();
    const { shiftId, newDate, newStartTime, newEndTime, newNotes, reason } =
      body;

    if (!shiftId) {
      return NextResponse.json(
        { error: "shiftId is required" },
        { status: 400 },
      );
    }

    // At least one change must be requested
    if (!newDate && !newStartTime && !newEndTime && newNotes === undefined) {
      return NextResponse.json(
        {
          error:
            "At least one change (date, start time, end time, or notes) is required",
        },
        { status: 400 },
      );
    }

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
      console.error("Failed to send notification for shift change request");
    }

    return NextResponse.json(changeRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating shift change request:", error);
    return NextResponse.json(
      { error: "Error creating request" },
      { status: 500 },
    );
  }
}
