import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { validateBody } from "@/lib/validations";

const VALID_BASE_ROLES = ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"] as const;

const updateCustomRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  nameEn: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  descriptionEn: z.string().max(500).optional().nullable(),
  baseRole: z.enum(VALID_BASE_ROLES).optional(),
  permissions: z.array(z.string().regex(/^[a-z-]+\.(\*|[a-z]+)$/)).optional(),
});

/**
 * PATCH /api/custom-roles/[id]
 */
export const PATCH = withRoute(
  "/api/custom-roles/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const authError = requireAdmin(user);
    if (authError) return authError;

    const planDenied = await requirePlanFeature(workspaceId, "customRoles");
    if (planDenied) return planDenied;

    const parsed = validateBody(updateCustomRoleSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existing = await prisma.customRole.findFirst({
      where: { id: params.id, workspaceId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    if (data.name && data.name !== existing.name) {
      const dup = await prisma.customRole.findFirst({
        where: {
          workspaceId,
          name: data.name,
          NOT: { id: params.id },
        },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          {
            error: "Eine Rolle mit diesem Namen existiert bereits.",
            code: "DUPLICATE_NAME",
          },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.customRole.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.descriptionEn !== undefined && {
          descriptionEn: data.descriptionEn,
        }),
        ...(data.baseRole !== undefined && { baseRole: data.baseRole }),
        ...(data.permissions !== undefined && {
          permissions: data.permissions,
        }),
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "CustomRole",
      entityId: params.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: data,
    });

    return NextResponse.json({ ...updated, builtIn: false });
  },
);

/**
 * DELETE /api/custom-roles/[id]
 */
export const DELETE = withRoute(
  "/api/custom-roles/[id]",
  "DELETE",
  async (_req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const authError = requireAdmin(user);
    if (authError) return authError;

    const planDenied = await requirePlanFeature(workspaceId, "customRoles");
    if (planDenied) return planDenied;

    const existing = await prisma.customRole.findFirst({
      where: { id: params.id, workspaceId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Detach the role from any users that currently have it set so we
    // do not orphan a non-null customRoleId pointing at a deleted row.
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { workspaceId, customRoleId: params.id },
        data: { customRoleId: null },
      }),
      prisma.customRole.delete({ where: { id: params.id } }),
    ]);

    createAuditLog({
      action: "DELETE",
      entityType: "CustomRole",
      entityId: params.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  },
);
