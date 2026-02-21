/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/** GET /api/automation-rules — list workspace automation rules */
export async function GET() {
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

    const rules = await (prisma as any).automationRule.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    // Parse JSON strings to objects
    const parsed = rules.map((r: any) => ({
      ...r,
      conditions: JSON.parse(r.conditions || "[]"),
      actions: JSON.parse(r.actions || "[]"),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error:", error);
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

    const { name, description, trigger, conditions, actions } =
      await req.json();

    if (!name || !trigger || !actions) {
      return NextResponse.json(
        { error: "name, trigger, and actions are required" },
        { status: 400 },
      );
    }

    const rule = await (prisma as any).automationRule.create({
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
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
