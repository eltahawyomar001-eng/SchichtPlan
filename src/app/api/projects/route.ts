import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createProjectSchema, validateBody } from "@/lib/validations";

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

    const { take, skip } = parsePagination(req);

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          members: { include: { employee: true } },
          _count: { select: { timeEntries: true } },
        },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.project.count({ where }),
    ]);

    return paginatedResponse(projects, total, take, skip);
  } catch (error) {
    log.error("Error fetching projects:", { error: error });
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

    const parsed = validateBody(createProjectSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const {
      name,
      description,
      clientId,
      costRate,
      billRate,
      budgetMinutes,
      startDate,
      endDate,
    } = parsed.data;

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        clientId: clientId || null,
        costRate: costRate ?? null,
        billRate: billRate ?? null,
        budgetMinutes: budgetMinutes ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        workspaceId: user.workspaceId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    log.error("Error creating project:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
