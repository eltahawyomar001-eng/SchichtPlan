import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can update locations
    const forbidden = requirePermission(user, "locations", "update");
    if (forbidden) return forbidden;

    const body = await req.json();

    const location = await prisma.location.updateMany({
      where: { id, workspaceId },
      data: {
        name: body.name,
        address: body.address || null,
      },
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can delete locations
    const forbidden = requirePermission(user, "locations", "delete");
    if (forbidden) return forbidden;

    await prisma.location.deleteMany({
      where: { id, workspaceId },
    });

    return NextResponse.json({ message: "Location deleted" });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
