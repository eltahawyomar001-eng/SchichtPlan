import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { updateAutomationRuleSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/automation-rules/[id] */
export const PATCH = withRoute(
  "/api/automation-rules/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "automations", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const body = await req.json();
    const parsed = validateBody(updateAutomationRuleSchema, body);
    if (!parsed.success) return parsed.response;
    const { data } = parsed;

    const existing = await prisma.automationRule.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.conditions !== undefined && {
          conditions: JSON.stringify(data.conditions),
        }),
        ...(data.actions !== undefined && {
          actions: JSON.stringify(data.actions),
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "AutomationRule",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: data,
    });

    dispatchWebhook(workspaceId, "automation_rule.updated", {
      id,
      ...data,
    }).catch(() => {});

    return NextResponse.json({
      ...rule,
      conditions: JSON.parse(rule.conditions || "[]"),
      actions: JSON.parse(rule.actions || "[]"),
    });
  },
);

/** DELETE /api/automation-rules/[id] */
export const DELETE = withRoute(
  "/api/automation-rules/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "automations", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    const existing = await prisma.automationRule.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.automationRule.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "AutomationRule",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "automation_rule.deleted", { id }).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  },
);
