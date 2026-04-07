import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createShiftTemplateSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const GET = withRoute("/api/shift-templates", "GET", async (req) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = (session.user as SessionUser).workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Check plan feature
  const planGate = await requirePlanFeature(workspaceId, "shiftTemplates");
  if (planGate) return planGate;

  const { take, skip } = parsePagination(req);

  const [templates, total] = await Promise.all([
    prisma.shiftTemplate.findMany({
      where: { workspaceId },
      include: {
        location: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startTime: "asc" },
      take,
      skip,
    }),
    prisma.shiftTemplate.count({ where: { workspaceId } }),
  ]);

  return paginatedResponse(templates, total, take, skip);
});

export const POST = withRoute(
  "/api/shift-templates",
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

    // Check plan feature
    const planGate = await requirePlanFeature(workspaceId, "shiftTemplates");
    if (planGate) return planGate;

    const parsed = validateBody(createShiftTemplateSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, startTime, endTime, color, locationId } = parsed.data;

    const template = await prisma.shiftTemplate.create({
      data: {
        name,
        startTime,
        endTime,
        color: color || null,
        locationId: locationId || null,
        workspaceId,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "ShiftTemplate",
      entityId: template.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, startTime, endTime },
    });

    dispatchWebhook(workspaceId, "shift_template.created", {
      id: template.id,
      name,
    }).catch(() => {});

    return NextResponse.json(template, { status: 201 });
  },
  { idempotent: true },
);
