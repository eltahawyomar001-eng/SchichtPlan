import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import {
  createStaffingRequirementSchema,
  validateBody,
} from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/staffing-requirements
 *
 * List all staffing requirements for the workspace.
 * Optional query params: ?locationId=xxx&weekday=0&active=true
 */
export const GET = withRoute(
  "/api/staffing-requirements",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const weekday = searchParams.get("weekday");
    const active = searchParams.get("active");
    const { take, skip } = parsePagination(req);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { workspaceId };
    if (locationId) where.locationId = locationId;
    if (weekday !== null && weekday !== "") where.weekday = parseInt(weekday);
    if (active === "true") where.isActive = true;

    const [requirements, total] = await Promise.all([
      prisma.staffingRequirement.findMany({
        where,
        include: {
          location: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          requiredSkill: { select: { id: true, name: true } },
        },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        take,
        skip,
      }),
      prisma.staffingRequirement.count({ where }),
    ]);

    return paginatedResponse(requirements, total, take, skip);
  },
);

/**
 * POST /api/staffing-requirements
 *
 * Create a new staffing requirement.
 */
export const POST = withRoute(
  "/api/staffing-requirements",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
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

    dispatchWebhook(workspaceId, "staffing_requirement.created", {
      id: requirement.id,
      name: data.name,
    }).catch(() => {});

    return NextResponse.json(requirement, { status: 201 });
  },
  { idempotent: true },
);
