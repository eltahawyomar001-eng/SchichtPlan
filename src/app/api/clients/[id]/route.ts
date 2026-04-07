import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { updateClientSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/clients/[id] */
export const GET = withRoute(
  "/api/clients/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id } = params;

    const client = await prisma.client.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: {
        projects: {
          include: { members: { include: { employee: true } } },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  },
);

/** PATCH /api/clients/[id] */
export const PATCH = withRoute(
  "/api/clients/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "clients", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(updateClientSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const existing = await prisma.client.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        email: body.email !== undefined ? body.email || null : existing.email,
        phone: body.phone !== undefined ? body.phone || null : existing.phone,
        address:
          body.address !== undefined ? body.address || null : existing.address,
        notes: body.notes !== undefined ? body.notes || null : existing.notes,
        isActive:
          body.isActive !== undefined ? body.isActive : existing.isActive,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: body,
    });

    dispatchWebhook(workspaceId, "client.updated", { id, ...body }).catch(
      () => {},
    );

    return NextResponse.json(client);
  },
);

/** DELETE /api/clients/[id] */
export const DELETE = withRoute(
  "/api/clients/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "clients", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    const existing = await prisma.client.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.client.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "Client",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "client.deleted", { id }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
