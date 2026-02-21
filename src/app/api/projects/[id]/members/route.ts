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

/** POST /api/projects/[id]/members — add a member */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const { employeeId, role } = await req.json();

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    // Verify project belongs to workspace
    const project = await (prisma as any).project.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const member = await (prisma as any).projectMember.create({
      data: {
        employeeId,
        projectId: id,
        role: role || "MEMBER",
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Employee is already a member" },
        { status: 409 },
      );
    }
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/projects/[id]/members — remove a member */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    await (prisma as any).projectMember.deleteMany({
      where: { projectId: id, employeeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
