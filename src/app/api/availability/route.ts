import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

// ─── GET  /api/availability ─────────────────────────────────────
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");

    const where: Record<string, unknown> = { workspaceId };
    if (employeeId) where.employeeId = employeeId;

    const availabilities = await prisma.availability.findMany({
      where,
      include: { employee: true },
      orderBy: [{ employeeId: "asc" }, { weekday: "asc" }],
    });

    return NextResponse.json(availabilities);
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── POST  /api/availability ────────────────────────────────────
// Accepts a batch of availability entries for an employee
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const body = await req.json();

    if (!body.employeeId || !body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: "employeeId und entries-Array sind erforderlich" },
        { status: 400 },
      );
    }

    // Delete existing entries for this employee's validity period, then re-create
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();

    await prisma.availability.deleteMany({
      where: {
        employeeId: body.employeeId,
        workspaceId,
        validFrom: { gte: validFrom },
      },
    });

    const created = await prisma.availability.createMany({
      data: body.entries.map(
        (entry: {
          weekday: number;
          startTime?: string;
          endTime?: string;
          type: string;
          notes?: string;
        }) => ({
          weekday: entry.weekday,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
          type: entry.type,
          validFrom,
          notes: entry.notes || null,
          employeeId: body.employeeId,
          workspaceId,
        }),
      ),
    });

    return NextResponse.json({ created: created.count }, { status: 201 });
  } catch (error) {
    console.error("Error saving availability:", error);
    return NextResponse.json({ error: "Error saving" }, { status: 500 });
  }
}
