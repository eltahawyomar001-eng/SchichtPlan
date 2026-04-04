import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { createSkillSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { id } = await params;

    const parsed = validateBody(createSkillSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, category } = parsed.data;

    const skill = await prisma.skill.update({
      where: { id, workspaceId },
      data: {
        name,
        category: category || null,
      },
    });

    return NextResponse.json(skill);
  } catch (error) {
    log.error("Error updating skill:", { error });
    captureRouteError(error, { route: "/api/skills/[id]", method: "PUT" });
    return NextResponse.json(
      { error: "Error updating skill" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const forbidden = requirePermission(user, "employees", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    await prisma.skill.delete({
      where: { id, workspaceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting skill:", { error });
    captureRouteError(error, { route: "/api/skills/[id]", method: "DELETE" });
    return NextResponse.json(
      { error: "Error deleting skill" },
      { status: 500 },
    );
  }
}
