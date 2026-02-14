import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── PATCH  /api/shift-swaps/[id] ───────────────────────────────
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: { shift: true, targetShift: true },
    });

    if (!existing || existing.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // Accept (by target employee)
    if (body.status === "ANGENOMMEN") {
      data.status = "ANGENOMMEN";
      data.targetId = body.targetId;
      if (body.targetShiftId) data.targetShiftId = body.targetShiftId;
    }

    // Approve / Reject (by manager)
    if (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") {
      data.status = body.status;
      data.reviewedBy = user.id;
      data.reviewedAt = new Date();
      data.reviewNote = body.reviewNote || null;
    }

    // Cancel
    if (body.status === "STORNIERT") {
      data.status = "STORNIERT";
    }

    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data,
      include: {
        requester: true,
        target: true,
        shift: { include: { location: true } },
        targetShift: { include: { location: true } },
      },
    });

    // If approved, actually swap the employee assignments
    if (
      body.status === "GENEHMIGT" &&
      existing.targetId &&
      existing.targetShiftId
    ) {
      await prisma.$transaction([
        prisma.shift.update({
          where: { id: existing.shiftId },
          data: { employeeId: existing.targetId },
        }),
        prisma.shift.update({
          where: { id: existing.targetShiftId },
          data: { employeeId: existing.requesterId },
        }),
        prisma.shiftSwapRequest.update({
          where: { id },
          data: { status: "ABGESCHLOSSEN" },
        }),
      ]);
    } else if (
      body.status === "GENEHMIGT" &&
      existing.targetId &&
      !existing.targetShiftId
    ) {
      // One-way swap: just reassign the shift
      await prisma.$transaction([
        prisma.shift.update({
          where: { id: existing.shiftId },
          data: { employeeId: existing.targetId },
        }),
        prisma.shiftSwapRequest.update({
          where: { id },
          data: { status: "ABGESCHLOSSEN" },
        }),
      ]);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating shift swap:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 },
    );
  }
}
