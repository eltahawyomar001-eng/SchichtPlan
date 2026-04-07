import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

/**
 * POST /api/shifts/[id]/confirm
 *
 * Employee confirms / acknowledges an assigned shift.
 * Changes shift status from SCHEDULED → CONFIRMED.
 */
export const POST = withRoute(
  "/api/shifts/[id]/confirm",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Fetch shift
    const shift = await prisma.shift.findFirst({
      where: { id, workspaceId },
      include: { employee: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Employee can only confirm their own shift
    if (user.role === "EMPLOYEE" && user.employeeId) {
      if (shift.employeeId !== user.employeeId) {
        return NextResponse.json(
          { error: "Sie können nur eigene Schichten bestätigen." },
          { status: 403 },
        );
      }
    }

    // Only SCHEDULED shifts can be confirmed
    if (shift.status !== "SCHEDULED") {
      return NextResponse.json(
        {
          error: `Schicht kann nicht bestätigt werden (Status: ${shift.status}).`,
        },
        { status: 400 },
      );
    }

    // Update status to CONFIRMED
    const updated = await prisma.shift.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });

    // Audit log
    createAuditLog({
      action: "UPDATE",
      entityType: "shift",
      entityId: id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId,
      changes: { status: "CONFIRMED", confirmedBy: user.id },
    });

    log.info("[shifts/confirm] Shift confirmed", {
      shiftId: id,
      employeeId: shift.employeeId,
      userId: user.id,
    });

    return NextResponse.json({
      ...updated,
      message: "Schicht erfolgreich bestätigt.",
    });
  },
  { idempotent: true },
);
