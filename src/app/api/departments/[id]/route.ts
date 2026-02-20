import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const department = await (prisma as any).department.update({
      where: { id },
      data: {
        name: name?.trim(),
        color: color || null,
        locationId: locationId || null,
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error updating department:", error);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json(
      { error: "Error deleting department" },
      { status: 500 },
    );
  }
}
