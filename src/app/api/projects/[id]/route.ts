import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { updateProjectSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id] */
export const GET = withRoute(
  "/api/projects/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id } = params;

    const project = await prisma.project.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: {
        client: true,
        members: { include: { employee: true } },
        timeEntries: {
          orderBy: { date: "desc" },
          take: 50,
          include: { employee: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Calculate totals
    const totalMinutes = project.timeEntries.reduce(
      (sum: number, te: { netMinutes: number }) => sum + te.netMinutes,
      0,
    );

    return NextResponse.json({ ...project, totalMinutes });
  },
);

/** PATCH /api/projects/[id] */
export const PATCH = withRoute(
  "/api/projects/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = params;
    const parsed = validateBody(updateProjectSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const existing = await prisma.project.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.clientId !== undefined && {
          client: body.clientId
            ? { connect: { id: body.clientId } }
            : { disconnect: true },
        }),
        ...(body.costRate !== undefined && {
          costRate: body.costRate ?? null,
        }),
        ...(body.billRate !== undefined && {
          billRate: body.billRate ?? null,
        }),
        ...(body.budgetMinutes !== undefined && {
          budgetMinutes: body.budgetMinutes ?? null,
        }),
        ...(body.startDate !== undefined && {
          startDate: body.startDate ? new Date(body.startDate) : null,
        }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Project",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: body,
    });

    dispatchWebhook(workspaceId, "project.updated", { id, ...body }).catch(
      () => {},
    );

    return NextResponse.json(project);
  },
);

/** DELETE /api/projects/[id] */
export const DELETE = withRoute(
  "/api/projects/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "reports", "delete");
    if (forbidden) return forbidden;

    const { id } = params;

    const existing = await prisma.project.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.project.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "Project",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "project.deleted", { id }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
