import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { skillAssignmentSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

/**
 * GET /api/skills/[id]/assignments
 * Returns all employee IDs assigned to this skill.
 */
export const GET = withRoute(
  "/api/skills/[id]/assignments",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { id } = params;

    const assignments = await prisma.employeeSkill.findMany({
      where: { skillId: id, employee: { workspaceId } },
      select: { employeeId: true },
    });

    return NextResponse.json(assignments.map((a) => a.employeeId));
  },
);

/**
 * PUT /api/skills/[id]/assignments
 * Set the complete list of employee IDs assigned to this skill.
 * Body: { employeeIds: string[] }
 * This is a "sync" operation: employees not in the list will be unassigned.
 */
export const PUT = withRoute(
  "/api/skills/[id]/assignments",
  "PUT",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const body = await req.json();
    const parsed = validateBody(skillAssignmentSchema, body);
    if (!parsed.success) return parsed.response;
    const employeeIds = parsed.data.employeeIds;

    // Verify skill belongs to this workspace
    const skill = await prisma.skill.findFirst({
      where: { id, workspaceId },
    });
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Get current assignments
    const current = await prisma.employeeSkill.findMany({
      where: { skillId: id, employee: { workspaceId } },
      select: { employeeId: true },
    });
    const currentIds = new Set(current.map((c) => c.employeeId));
    const desiredIds = new Set(employeeIds);

    // Determine additions and removals
    const toAdd = employeeIds.filter((eid) => !currentIds.has(eid));
    const toRemove = [...currentIds].filter((eid) => !desiredIds.has(eid));

    // Execute in a transaction
    await prisma.$transaction([
      // Remove unselected
      ...(toRemove.length > 0
        ? [
            prisma.employeeSkill.deleteMany({
              where: {
                skillId: id,
                employeeId: { in: toRemove },
              },
            }),
          ]
        : []),
      // Add newly selected
      ...toAdd.map((employeeId) =>
        prisma.employeeSkill.create({
          data: { skillId: id, employeeId },
        }),
      ),
    ]);

    createAuditLog({
      action: "UPDATE",
      entityType: "SkillAssignment",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { added: toAdd, removed: toRemove },
    });

    return NextResponse.json({ success: true });
  },
);
