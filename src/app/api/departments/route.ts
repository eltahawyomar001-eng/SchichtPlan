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

     
    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where: { workspaceId },
        include: {
          location: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.department.count({ where: { workspaceId } }),
    ]);
     

    return paginatedResponse(departments, total, take, skip);
  } catch (error) {
    log.error("Error fetching departments:", { error: error });
    return NextResponse.json(
      { error: "Error loading departments" },
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

    // Only management can create departments
    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    const { name, color, locationId } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich." },
        { status: 400 },
      );
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        color: color || null,
        locationId: locationId || null,
        workspaceId,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    log.error("Error creating department:", { error: error });
    return NextResponse.json(
      { error: "Error creating department" },
      { status: 500 },
    );
  }
}
