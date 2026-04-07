import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkShiftConflicts } from "@/lib/automations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/shifts/[id]/claim
 * Allows an employee to claim an open (unassigned) shift.
 */
export const POST = withRoute(
  "/api/shifts/[id]/claim",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const employeeId = user.employeeId;

    if (!employeeId) {
      return NextResponse.json(
        {
          error: "Kein Mitarbeiterprofil verknüpft.",
        },
        { status: 400 },
      );
    }

    const { id } = params;

    // Fetch the shift
    const shift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!shift) {
      return NextResponse.json(
        { error: "Schicht nicht gefunden." },
        { status: 404 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((shift as any).status !== "OPEN" || shift.employeeId) {
      return NextResponse.json(
        {
          error: "Diese Schicht ist bereits vergeben.",
        },
        { status: 409 },
      );
    }

    // Check for conflicts
    const conflicts = await checkShiftConflicts({
      employeeId,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      workspaceId: shift.workspaceId,
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Zeitkonflikt mit bestehender Schicht.",
          conflicts,
        },
        { status: 409 },
      );
    }

    // Claim the shift
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma.shift.update as any)({
      where: { id },
      data: {
        employeeId,
        status: "SCHEDULED",
      },
      include: {
        employee: true,
        location: true,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Shift",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "CLAIM", employeeId },
    });

    return NextResponse.json(updated);
  },
  { idempotent: true },
);
