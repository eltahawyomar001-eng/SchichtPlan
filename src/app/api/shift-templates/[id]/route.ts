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
    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const { name, startTime, endTime, color, locationId } = await req.json();

    const template = await prisma.shiftTemplate.update({
      where: { id },
      data: {
        name: name?.trim(),
        startTime,
        endTime,
        color: color || null,
        locationId: locationId || null,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    log.error("Error updating template:", { error: error });
    return NextResponse.json(
      { error: "Error updating template" },
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
    const forbidden = requirePermission(user, "shifts", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    await prisma.shiftTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting template:", { error: error });
    return NextResponse.json(
      { error: "Error deleting template" },
      { status: 500 },
    );
  }
}
