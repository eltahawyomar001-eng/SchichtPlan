/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/** GET /api/projects — list all projects for the workspace */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "projects", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { workspaceId: user.workspaceId };
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    const projects = await (prisma as any).project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        members: { include: { employee: true } },
        _count: { select: { timeEntries: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/projects — create a new project */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "projects", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const {
      name,
      description,
      clientId,
      costRate,
      billRate,
      budgetMinutes,
      startDate,
      endDate,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const project = await (prisma as any).project.create({
      data: {
        name,
        description: description || null,
        clientId: clientId || null,
        costRate: costRate ? parseFloat(costRate) : null,
        billRate: billRate ? parseFloat(billRate) : null,
        budgetMinutes: budgetMinutes ? parseInt(budgetMinutes, 10) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        workspaceId: user.workspaceId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
