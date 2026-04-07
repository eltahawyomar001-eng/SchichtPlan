import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { assignEmployeeSkillSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * GET /api/employees/[id]/skills
 * Returns all skills for an employee.
 */
export const GET = withRoute(
  "/api/employees/[id]/skills",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const employeeSkills = await prisma.employeeSkill.findMany({
      where: { employeeId: id },
      include: { skill: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(employeeSkills);
  },
);

/**
 * POST /api/employees/[id]/skills
 * Assign a skill to an employee.
 * Body: { skillId: string, expiresAt?: string }
 */
export const POST = withRoute(
  "/api/employees/[id]/skills",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(assignEmployeeSkillSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { skillId, expiresAt } = parsed.data;

    const es = await prisma.employeeSkill.create({
      data: {
        employeeId: id,
        skillId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { skill: true },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "EmployeeSkill",
      entityId: es.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId: id, skillId },
    });

    return NextResponse.json(es, { status: 201 });
  },
  { idempotent: true },
);
