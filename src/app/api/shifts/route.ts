import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const where: { workspaceId: string; date?: { gte: Date; lte: Date } } = {
      workspaceId,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        employee: true,
        location: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const body = await req.json();
    const { date, startTime, endTime, employeeId, locationId, notes } = body;

    if (!date || !startTime || !endTime || !employeeId) {
      return NextResponse.json(
        { error: "Datum, Start-/Endzeit und Mitarbeiter sind erforderlich." },
        { status: 400 },
      );
    }

    const shift = await prisma.shift.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        notes: notes || null,
        employeeId,
        locationId: locationId || null,
        workspaceId,
      },
      include: {
        employee: true,
        location: true,
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error("Error creating shift:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen" },
      { status: 500 },
    );
  }
}
