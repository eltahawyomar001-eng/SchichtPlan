import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import {
  updateStaffingRequirementSchema,
  validateBody,
} from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * GET /api/staffing-requirements/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { id } = await params;

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
  } catch (error) {
    log.error("Error fetching staffing requirement:", { error });
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

/**
 * PUT /api/staffing-requirements/[id]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const { id } = await params;

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

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error updating staffing requirement:", { error });
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/staffing-requirements/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting staffing requirement:", { error });
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
