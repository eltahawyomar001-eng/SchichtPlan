import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { createSkillSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const PUT = withRoute(
  "/api/skills/[id]",
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

    const parsed = validateBody(createSkillSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, category } = parsed.data;

    const skill = await prisma.skill.update({
      where: { id, workspaceId },
      data: {
        name,
        category: category || null,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Skill",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, category },
    });

    dispatchWebhook(workspaceId, "skill.updated", { id, name, category }).catch(
      () => {},
    );

    return NextResponse.json(skill);
  },
);

export const DELETE = withRoute(
  "/api/skills/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "employees", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    await prisma.skill.delete({
      where: { id, workspaceId },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "Skill",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "skill.deleted", { id }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
