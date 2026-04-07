import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import {
  updateStaffingRequirementSchema,
  validateBody,
} from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/staffing-requirements/[id]
 */
export const GET = withRoute(
  "/api/staffing-requirements/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { id } = params;

    const requirement = await prisma.staffingRequirement.findFirst({
      where: { id, workspaceId },
      include: {
        location: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requiredSkill: { select: { id: true, name: true } },
      },
    });

    if (!requirement) {
      return NextResponse.json(
        { error: "Personalanforderung nicht gefunden" },
        { status: 404 },
      );
    }

    return NextResponse.json(requirement);
  },
);

/**
 * PUT /api/staffing-requirements/[id]
 */
export const PUT = withRoute(
  "/api/staffing-requirements/[id]",
  "PUT",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const { id } = params;

    const existing = await prisma.staffingRequirement.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Personalanforderung nicht gefunden" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = validateBody(updateStaffingRequirementSchema, body);
    if (!parsed.success) return parsed.response;

    const data = parsed.data;

    const updated = await prisma.staffingRequirement.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.weekday !== undefined && { weekday: data.weekday }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.minEmployees !== undefined && {
          minEmployees: data.minEmployees,
        }),
        ...(data.maxEmployees !== undefined && {
          maxEmployees: data.maxEmployees ?? null,
        }),
        ...(data.requiredSkillId !== undefined && {
          requiredSkillId: data.requiredSkillId || null,
        }),
        ...(data.locationId !== undefined && {
          locationId: data.locationId || null,
        }),
        ...(data.departmentId !== undefined && {
          departmentId: data.departmentId || null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.validFrom !== undefined && {
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
        }),
        ...(data.validUntil !== undefined && {
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
        }),
      },
      include: {
        location: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requiredSkill: { select: { id: true, name: true } },
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "StaffingRequirement",
      entityId: id,
      userId: user.id,
      userEmail: user.email!,
      workspaceId,
      changes: data,
    });

    dispatchWebhook(workspaceId, "staffing_requirement.updated", { id }).catch(
      () => {},
    );

    return NextResponse.json(updated);
  },
);

/**
 * DELETE /api/staffing-requirements/[id]
 */
export const DELETE = withRoute(
  "/api/staffing-requirements/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    const existing = await prisma.staffingRequirement.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Personalanforderung nicht gefunden" },
        { status: 404 },
      );
    }

    await prisma.staffingRequirement.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "StaffingRequirement",
      entityId: id,
      userId: user.id,
      userEmail: user.email!,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "staffing_requirement.deleted", { id }).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  },
);
