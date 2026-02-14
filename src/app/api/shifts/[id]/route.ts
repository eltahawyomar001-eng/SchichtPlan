import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as SessionUser).workspaceId;
    const body = await req.json();

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
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as SessionUser).workspaceId;

    await prisma.shift.deleteMany({
      where: { id, workspaceId },
    });

    return NextResponse.json({ message: "Schicht gelöscht" });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
