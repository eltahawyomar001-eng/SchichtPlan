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

/** GET /api/clients/[id] */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    const client = await (prisma as any).client.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: {
        projects: {
          include: { members: { include: { employee: true } } },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH /api/clients/[id] */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "reports", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await req.json();

    const existing = await (prisma as any).client.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const client = await (prisma as any).client.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        email: body.email !== undefined ? body.email || null : existing.email,
        phone: body.phone !== undefined ? body.phone || null : existing.phone,
        address:
          body.address !== undefined ? body.address || null : existing.address,
        notes: body.notes !== undefined ? body.notes || null : existing.notes,
        isActive:
          body.isActive !== undefined ? body.isActive : existing.isActive,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/clients/[id] */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requirePermission(user, "reports", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    const existing = await (prisma as any).client.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).client.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
