import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { createDepartmentSchema, validateBody } from "@/lib/validations";
import { requireAuth, serverError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { workspaceId } = auth;

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
  } catch {
    return serverError("Error loading departments");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only management can create departments
    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createDepartmentSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, color, locationId } = parsed.data;

    const department = await prisma.department.create({
      data: {
        name,
        color: color || null,
        locationId: locationId || null,
        workspaceId,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch {
    return serverError("Error creating department");
  }
}
