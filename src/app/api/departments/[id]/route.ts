import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";

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
    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const { name, color, locationId } = await req.json();

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: name?.trim(),
        color: color || null,
        locationId: locationId || null,
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    log.error("Error updating department:", { error: error });
    return NextResponse.json(
      { error: "Error updating department" },
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
    const forbidden = requirePermission(user, "employees", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting department:", { error: error });
    return NextResponse.json(
      { error: "Error deleting department" },
      { status: 500 },
    );
  }
}
