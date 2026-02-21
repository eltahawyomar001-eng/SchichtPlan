/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/automation-rules/[id] */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "automations", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await req.json();

    const existing = await (prisma as any).automationRule.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rule = await (prisma as any).automationRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.trigger !== undefined && { trigger: body.trigger }),
        ...(body.conditions !== undefined && {
          conditions: JSON.stringify(body.conditions),
        }),
        ...(body.actions !== undefined && {
          actions: JSON.stringify(body.actions),
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json({
      ...rule,
      conditions: JSON.parse(rule.conditions || "[]"),
      actions: JSON.parse(rule.actions || "[]"),
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/automation-rules/[id] */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "automations", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    const existing = await (prisma as any).automationRule.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).automationRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
