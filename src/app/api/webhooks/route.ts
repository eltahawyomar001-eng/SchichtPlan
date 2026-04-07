import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import crypto from "crypto";
import { createWebhookSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/** GET /api/webhooks — list all webhook endpoints */
export const GET = withRoute("/api/webhooks", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "webhooks", "read");
  if (forbidden) return forbidden;

  // Check plan feature
  const planGate = await requirePlanFeature(user.workspaceId!, "apiWebhooks");
  if (planGate) return planGate;

  const { take, skip } = parsePagination(req);

  const [hooks, total] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.webhookEndpoint.count({
      where: { workspaceId: user.workspaceId },
    }),
  ]);

  return paginatedResponse(hooks, total, take, skip);
});

/** POST /api/webhooks — create a new webhook endpoint */
export const POST = withRoute(
  "/api/webhooks",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "webhooks", "create");
    if (forbidden) return forbidden;

    // Check plan feature
    const planGate = await requirePlanFeature(user.workspaceId!, "apiWebhooks");
    if (planGate) return planGate;

    const body = await req.json();
    const parsed = validateBody(createWebhookSchema, body);
    if (!parsed.success) return parsed.response;
    const { url, events } = parsed.data;

    const secret = crypto.randomBytes(32).toString("hex");

    const hook = await prisma.webhookEndpoint.create({
      data: {
        url,
        secret,
        events,
        workspaceId: user.workspaceId,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "WebhookEndpoint",
      entityId: hook.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { url, events },
    });

    dispatchWebhook(workspaceId, "webhook_endpoint.created", {
      id: hook.id,
      url,
      events,
    }).catch(() => {});

    return NextResponse.json(hook, { status: 201 });
  },
  { idempotent: true },
);
