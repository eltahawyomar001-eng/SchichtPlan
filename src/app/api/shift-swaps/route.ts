import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

// ─── GET  /api/shift-swaps ──────────────────────────────────────
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
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;

    const swaps = await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        requester: true,
        target: true,
        shift: { include: { location: true } },
        targetShift: { include: { location: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(swaps);
  } catch (error) {
    console.error("Error fetching shift swaps:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// ─── POST  /api/shift-swaps ─────────────────────────────────────
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

    if (!body.shiftId || !body.requesterId) {
      return NextResponse.json(
        { error: "Schicht und anfragender Mitarbeiter sind erforderlich" },
        { status: 400 },
      );
    }

    // Verify shift belongs to requester
    const shift = await prisma.shift.findUnique({
      where: { id: body.shiftId },
    });

    if (!shift || shift.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Schicht nicht gefunden" },
        { status: 404 },
      );
    }

    if (shift.employeeId !== body.requesterId) {
      return NextResponse.json(
        { error: "Die Schicht gehört nicht dem anfragenden Mitarbeiter" },
        { status: 400 },
      );
    }

    const swap = await prisma.shiftSwapRequest.create({
      data: {
        shiftId: body.shiftId,
        targetShiftId: body.targetShiftId || null,
        requesterId: body.requesterId,
        targetId: body.targetId || null,
        reason: body.reason || null,
        workspaceId,
      },
      include: {
        requester: true,
        target: true,
        shift: { include: { location: true } },
      },
    });

    return NextResponse.json(swap, { status: 201 });
  } catch (error) {
    console.error("Error creating shift swap:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen" },
      { status: 500 },
    );
  }
}
