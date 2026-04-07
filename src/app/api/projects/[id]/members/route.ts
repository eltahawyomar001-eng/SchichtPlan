import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import {
  addProjectMemberSchema,
  removeProjectMemberSchema,
  validateBody,
} from "@/lib/validations";
import { log } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/projects/[id]/members — add a member */
export const POST = withRoute(
  "/api/projects/[id]/members",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(addProjectMemberSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { employeeId, role } = parsed.data;

    // Verify project belongs to workspace
    const project = await prisma.project.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const member = await prisma.projectMember.create({
      data: {
        employeeId,
        projectId: id,
        role: role || "MEMBER",
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "ProjectMember",
      entityId: member.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId, projectId: id, role: role || "MEMBER" },
    });

    return NextResponse.json(member, { status: 201 });
  },
  { idempotent: true },
);

/** DELETE /api/projects/[id]/members — remove a member */
export const DELETE = withRoute(
  "/api/projects/[id]/members",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(removeProjectMemberSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { employeeId } = parsed.data;

    await prisma.projectMember.deleteMany({
      where: { projectId: id, employeeId },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "ProjectMember",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId, projectId: id },
    });

    return NextResponse.json({ success: true });
  },
);
