import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { updateWebhookSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/webhooks/[id] — update a webhook */
export const PATCH = withRoute(
  "/api/webhooks/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "webhooks", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const body = await req.json();
    const parsed = validateBody(updateWebhookSchema, body);
    if (!parsed.success) return parsed.response;
    const { data: validData } = parsed;

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hook = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(validData.url !== undefined && { url: validData.url }),
        ...(validData.events !== undefined && { events: validData.events }),
        ...(validData.isActive !== undefined && {
          isActive: validData.isActive,
        }),
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "WebhookEndpoint",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: validData,
    });

    dispatchWebhook(workspaceId, "webhook_endpoint.updated", {
      id,
      ...validData,
    }).catch(() => {});

    return NextResponse.json(hook);
  },
);

/** DELETE /api/webhooks/[id] */
export const DELETE = withRoute(
  "/api/webhooks/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "webhooks", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.webhookEndpoint.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "WebhookEndpoint",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "webhook_endpoint.deleted", { id }).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  },
);
