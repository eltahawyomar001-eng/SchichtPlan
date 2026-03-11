import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isEmployee } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createAvailabilitySchema, validateBody } from "@/lib/validations";

// ─── GET  /api/availability ─────────────────────────────────────
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
    const employeeId = searchParams.get("employeeId");

    const where: Record<string, unknown> = { workspaceId };
    if (employeeId) where.employeeId = employeeId;

    const { take, skip } = parsePagination(req);

    const [availabilities, total] = await Promise.all([
      prisma.availability.findMany({
        where,
        include: { employee: true },
        orderBy: [{ employeeId: "asc" }, { weekday: "asc" }],
        take,
        skip,
      }),
      prisma.availability.count({ where }),
    ]);

    return paginatedResponse(availabilities, total, take, skip);
  } catch (error) {
    log.error("Error fetching availability:", { error: error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── POST  /api/availability ────────────────────────────────────
// Accepts a batch of availability entries for an employee
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

    const parsed = validateBody(createAvailabilitySchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // EMPLOYEE can only manage their own availability
    if (isEmployee(user)) {
      const linkedEmployee = await prisma.employee.findFirst({
        where: { workspaceId, email: user.email ?? undefined },
      });
      if (!linkedEmployee || body.employeeId !== linkedEmployee.id) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Sie können nur Ihre eigene Verfügbarkeit verwalten.",
          },
          { status: 403 },
        );
      }
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
      data: body.entries.map((entry) => ({
        weekday: entry.weekday,
        startTime: entry.startTime || null,
        endTime: entry.endTime || null,
        type: entry.type,
        validFrom,
        notes: entry.notes || null,
        employeeId: body.employeeId,
        workspaceId,
      })),
    });

    return NextResponse.json({ created: created.count }, { status: 201 });
  } catch (error) {
    log.error("Error saving availability:", { error: error });
    return NextResponse.json({ error: "Error saving" }, { status: 500 });
  }
}
