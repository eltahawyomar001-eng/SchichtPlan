import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createProjectSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/** GET /api/projects — list all projects for the workspace */
export const GET = withRoute("/api/projects", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "projects", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { workspaceId: user.workspaceId };
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;

  const { take, skip } = parsePagination(req);

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        members: { include: { employee: true } },
        _count: { select: { timeEntries: true } },
      },
      orderBy: { name: "asc" },
      take,
      skip,
    }),
    prisma.project.count({ where }),
  ]);

  return paginatedResponse(projects, total, take, skip);
});

/** POST /api/projects — create a new project */
export const POST = withRoute(
  "/api/projects",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "projects", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createProjectSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const {
      name,
      description,
      clientId,
      costRate,
      billRate,
      budgetMinutes,
      startDate,
      endDate,
    } = parsed.data;

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        clientId: clientId || null,
        costRate: costRate ?? null,
        billRate: billRate ?? null,
        budgetMinutes: budgetMinutes ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        workspaceId: user.workspaceId,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "Project",
      entityId: project.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, clientId },
    });

    dispatchWebhook(workspaceId, "project.created", {
      id: project.id,
      name,
    }).catch(() => {});

    return NextResponse.json(project, { status: 201 });
  },
  { idempotent: true },
);
