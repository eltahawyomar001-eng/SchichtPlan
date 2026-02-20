import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isEmployee } from "@/lib/authorization";
import { createSystemNotification } from "@/lib/automations";

// ─── GET  /api/shift-swaps ──────────────────────────────────────
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

    // EMPLOYEE can only see swaps they are involved in
    if (isEmployee(user) && user.employeeId) {
      where.OR = [
        { requesterId: user.employeeId },
        { targetId: user.employeeId },
      ];
    }

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
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── POST  /api/shift-swaps ─────────────────────────────────────
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

    if (!body.shiftId || !body.requesterId) {
      return NextResponse.json(
        { error: "Shift and requester are required" },
        { status: 400 },
      );
    }

    // Verify shift belongs to requester
    const shift = await prisma.shift.findUnique({
      where: { id: body.shiftId },
    });

    if (!shift || shift.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    if (shift.employeeId !== body.requesterId) {
      return NextResponse.json(
        { error: "The shift does not belong to the requester" },
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

    // ── Automation: Notify managers about new swap request ──
    const requesterName = `${swap.requester.firstName} ${swap.requester.lastName}`;
    const shiftDate =
      swap.shift.date instanceof Date
        ? swap.shift.date.toLocaleDateString("de-DE")
        : new Date(swap.shift.date).toLocaleDateString("de-DE");

    await createSystemNotification({
      type: "SWAP_REQUESTED",
      title: "Neuer Schichttausch-Antrag",
      message: `${requesterName} möchte die Schicht am ${shiftDate} (${swap.shift.startTime}–${swap.shift.endTime}) tauschen.`,
      link: "/schichttausch",
      workspaceId,
      recipientType: "managers",
    });

    return NextResponse.json(swap, { status: 201 });
  } catch (error) {
    console.error("Error creating shift swap:", error);
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
