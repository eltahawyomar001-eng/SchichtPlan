import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { checkShiftConflicts } from "@/lib/automations";

/**
 * POST /api/shifts/[id]/claim
 * Allows an employee to claim an open (unassigned) shift.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const employeeId = user.employeeId;

    if (!employeeId) {
      return NextResponse.json(
        {
          error: "Kein Mitarbeiterprofil verknüpft.",
        },
        { status: 400 },
      );
    }

    const { id } = await params;

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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error claiming shift:", error);
    return NextResponse.json(
      { error: "Error claiming shift" },
      { status: 500 },
    );
  }
}
