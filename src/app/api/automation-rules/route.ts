import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createAutomationRuleSchema, validateBody } from "@/lib/validations";

/** GET /api/automation-rules — list workspace automation rules */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

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
  } catch (error) {
    log.error("Error:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/automation-rules — create a new rule.
 * Body: { name, description?, trigger, conditions: object[], actions: object[] }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

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

    return NextResponse.json(
      { ...rule, conditions: conditions || [], actions },
      { status: 201 },
    );
  } catch (error) {
    log.error("Error:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
