import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { updateShiftTemplateSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const PUT = withRoute(
  "/api/shift-templates/[id]",
  "PUT",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(updateShiftTemplateSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, startTime, endTime, color, locationId } = parsed.data;

    const template = await prisma.shiftTemplate.update({
      where: { id },
      data: {
        name: name?.trim(),
        startTime,
        endTime,
        color: color || null,
        locationId: locationId || null,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "ShiftTemplate",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, startTime, endTime, color, locationId },
    });

    dispatchWebhook(workspaceId, "shift_template.updated", { id, name }).catch(
      () => {},
    );

    return NextResponse.json(template);
  },
);

export const DELETE = withRoute(
  "/api/shift-templates/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    await prisma.shiftTemplate.delete({
      where: { id },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "ShiftTemplate",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "shift_template.deleted", { id }).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  },
);
