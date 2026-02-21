/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id] */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    const project = await (prisma as any).project.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: {
        client: true,
        members: { include: { employee: true } },
        timeEntries: {
          orderBy: { date: "desc" },
          take: 50,
          include: { employee: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Calculate totals
    const totalMinutes = project.timeEntries.reduce(
      (sum: number, te: { netMinutes: number }) => sum + te.netMinutes,
      0,
    );

    return NextResponse.json({ ...project, totalMinutes });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH /api/projects/[id] */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await req.json();

    const existing = await (prisma as any).project.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const project = await (prisma as any).project.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.clientId !== undefined && {
          clientId: body.clientId || null,
        }),
        ...(body.costRate !== undefined && {
          costRate: body.costRate ? parseFloat(body.costRate) : null,
        }),
        ...(body.billRate !== undefined && {
          billRate: body.billRate ? parseFloat(body.billRate) : null,
        }),
        ...(body.budgetMinutes !== undefined && {
          budgetMinutes: body.budgetMinutes
            ? parseInt(body.budgetMinutes, 10)
            : null,
        }),
        ...(body.startDate !== undefined && {
          startDate: body.startDate ? new Date(body.startDate) : null,
        }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/projects/[id] */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "reports", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    const existing = await (prisma as any).project.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
