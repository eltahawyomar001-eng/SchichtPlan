import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/**
 * DELETE /api/invitations/[id] — revoke a pending invitation
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { id },
  });

  if (!invitation || invitation.workspaceId !== user.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only pending invitations can be revoked" },
      { status: 400 },
    );
  }

  await prisma.invitation.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  return NextResponse.json({ success: true });
}
