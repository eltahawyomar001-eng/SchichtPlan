import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";

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

    const data: Record<string, unknown> = {
      name: body.name,
      address: body.address || null,
    };

    // Geo fields for service visit geofencing
    if (body.latitude !== undefined)
      data.latitude = body.latitude !== null ? Number(body.latitude) : null;
    if (body.longitude !== undefined)
      data.longitude = body.longitude !== null ? Number(body.longitude) : null;
    if (body.geofenceRadius !== undefined)
      data.geofenceRadius = Number(body.geofenceRadius);

    const location = await prisma.location.updateMany({
      where: { id, workspaceId },
      data,
    });

    return NextResponse.json(location);
  } catch (error) {
    log.error("Error updating location:", { error: error });
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
    log.error("Error deleting location:", { error: error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
