import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createAutomationRuleSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/** GET /api/automation-rules — list workspace automation rules */
export const GET = withRoute("/api/automation-rules", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "automations", "read");
  if (forbidden) return forbidden;

  const { take, skip } = parsePagination(req);

  const [rules, total] = await Promise.all([
    prisma.automationRule.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.automationRule.count({
      where: { workspaceId: user.workspaceId },
    }),
  ]);

  // Parse JSON strings to objects
  const parsed = rules.map((r) => ({
    ...r,
    conditions: JSON.parse(r.conditions || "[]"),
    actions: JSON.parse(r.actions || "[]"),
  }));

  return paginatedResponse(parsed, total, take, skip);
});

/**
 * POST /api/automation-rules — create a new rule.
 * Body: { name, description?, trigger, conditions: object[], actions: object[] }
 */
export const POST = withRoute(
  "/api/automation-rules",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "automations", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createAutomationRuleSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, description, trigger, conditions, actions } = parsed.data;

    if (!name || !trigger || !actions) {
      return NextResponse.json(
        { error: "name, trigger, and actions are required" },
        { status: 400 },
      );
    }

    const rule = await prisma.automationRule.create({
      data: {
        name,
        description: description || null,
        trigger,
        conditions: JSON.stringify(conditions || []),
        actions: JSON.stringify(actions),
        workspaceId: user.workspaceId,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "AutomationRule",
      entityId: rule.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, trigger },
    });

    dispatchWebhook(workspaceId, "automation_rule.created", {
      id: rule.id,
      name,
      trigger,
    }).catch(() => {});

    return NextResponse.json(
      { ...rule, conditions: conditions || [], actions },
      { status: 201 },
    );
  },
  { idempotent: true },
);
