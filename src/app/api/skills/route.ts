import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { take, skip } = parsePagination(req);

     
    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where: { workspaceId },
        include: {
          _count: { select: { employeeSkills: true } },
        },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.skill.count({ where: { workspaceId } }),
    ]);
     

    return paginatedResponse(skills, total, take, skip);
  } catch (error) {
    log.error("Error fetching skills:", { error: error });
    return NextResponse.json(
      { error: "Error loading skills" },
      { status: 500 },
    );
  }
}

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

    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    const { name, category } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich." },
        { status: 400 },
      );
    }

    const skill = await prisma.skill.create({
      data: {
        name: name.trim(),
        category: category || null,
        workspaceId,
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Diese Qualifikation existiert bereits.",
        },
        { status: 409 },
      );
    }
    log.error("Error creating skill:", { error: error });
    return NextResponse.json(
      { error: "Error creating skill" },
      { status: 500 },
    );
  }
}
