import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { checkShiftConflicts } from "@/lib/automations";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can update shifts
    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const body = await req.json();

    // If date/time/employee changed, run conflict detection
    if (body.date || body.startTime || body.endTime || body.employeeId) {
      // Fetch the current shift to fill in unchanged fields
      const currentShift = await prisma.shift.findFirst({
        where: { id, workspaceId },
      });
      if (!currentShift) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const conflicts = await checkShiftConflicts({
        employeeId: body.employeeId || currentShift.employeeId,
        date: body.date || currentShift.date.toISOString().split("T")[0],
        startTime: body.startTime || currentShift.startTime,
        endTime: body.endTime || currentShift.endTime,
        workspaceId,
        excludeShiftId: id,
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "Conflicts detected", conflicts },
          { status: 409 },
        );
      }
    }

    const shift = await prisma.shift.updateMany({
      where: { id, workspaceId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        startTime: body.startTime,
        endTime: body.endTime,
        employeeId: body.employeeId,
        locationId: body.locationId || null,
        notes: body.notes,
        status: body.status,
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error updating shift:", error);
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can delete shifts
    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    await prisma.shift.deleteMany({
      where: { id, workspaceId },
    });

    return NextResponse.json({ message: "Shift deleted" });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
