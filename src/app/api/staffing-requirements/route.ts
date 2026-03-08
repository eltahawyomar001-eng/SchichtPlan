import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import {
  createStaffingRequirementSchema,
  validateBody,
} from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * GET /api/staffing-requirements
 *
 * List all staffing requirements for the workspace.
 * Optional query params: ?locationId=xxx&weekday=0&active=true
 */
export async function GET(req: Request) {
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

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const weekday = searchParams.get("weekday");
    const active = searchParams.get("active");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { workspaceId };
    if (locationId) where.locationId = locationId;
    if (weekday !== null && weekday !== "") where.weekday = parseInt(weekday);
    if (active === "true") where.isActive = true;

    const requirements = await prisma.staffingRequirement.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requiredSkill: { select: { id: true, name: true } },
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ requirements });
  } catch (error) {
    log.error("Error fetching staffing requirements:", { error });
    return NextResponse.json(
      { error: "Fehler beim Laden der Personalanforderungen" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/staffing-requirements
 *
 * Create a new staffing requirement.
 */
export async function POST(req: Request) {
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

    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(createStaffingRequirementSchema, body);
    if (!parsed.success) return parsed.response;

    const data = parsed.data;

    const requirement = await prisma.staffingRequirement.create({
      data: {
        name: data.name,
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        minEmployees: data.minEmployees,
        maxEmployees: data.maxEmployees ?? null,
        requiredSkillId: data.requiredSkillId || null,
        locationId: data.locationId || null,
        departmentId: data.departmentId || null,
        isActive: data.isActive ?? true,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        workspaceId,
      },
      include: {
        location: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requiredSkill: { select: { id: true, name: true } },
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "StaffingRequirement",
      entityId: requirement.id,
      userId: user.id,
      userEmail: user.email!,
      workspaceId,
      metadata: {
        name: data.name,
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        minEmployees: data.minEmployees,
      },
    });

    return NextResponse.json(requirement, { status: 201 });
  } catch (error) {
    log.error("Error creating staffing requirement:", { error });
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Personalanforderung" },
      { status: 500 },
    );
  }
}
