import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/**
 * GET /api/employees/[id]/skills
 * Returns all skills for an employee.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeSkills = await (prisma as any).employeeSkill.findMany({
      where: { employeeId: id },
      include: { skill: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(employeeSkills);
  } catch (error) {
    console.error("Error fetching employee skills:", error);
    return NextResponse.json(
      { error: "Error loading skills" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/employees/[id]/skills
 * Assign a skill to an employee.
 * Body: { skillId: string, expiresAt?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const { skillId, expiresAt } = await req.json();

    if (!skillId) {
      return NextResponse.json(
        { error: "skillId ist erforderlich." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const es = await (prisma as any).employeeSkill.create({
      data: {
        employeeId: id,
        skillId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { skill: true },
    });

    return NextResponse.json(es, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Qualifikation bereits zugewiesen.",
        },
        { status: 409 },
      );
    }
    console.error("Error assigning skill:", error);
    return NextResponse.json(
      { error: "Error assigning skill" },
      { status: 500 },
    );
  }
}
