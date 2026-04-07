import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { updateDepartmentSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const PUT = withRoute(
  "/api/departments/[id]",
  "PUT",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(updateDepartmentSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, color, locationId } = parsed.data;

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: name?.trim(),
        color: color || null,
        locationId: locationId || null,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Department",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, color, locationId },
    });

    dispatchWebhook(workspaceId, "department.updated", {
      id,
      name,
      color,
      locationId,
    }).catch(() => {});

    return NextResponse.json(department);
  },
);

export const DELETE = withRoute(
  "/api/departments/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    await prisma.department.delete({
      where: { id },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "Department",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "department.deleted", { id }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
