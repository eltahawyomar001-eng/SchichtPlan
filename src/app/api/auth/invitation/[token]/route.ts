import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/invitation/[token] — public endpoint to get invitation details
 * No authentication required — used by the invitation accept page to show details
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "INVITATION_" + invitation.status },
      { status: 410 },
    );
  }

  if (new Date() > invitation.expiresAt) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "INVITATION_EXPIRED" }, { status: 410 });
  }

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    workspaceName: invitation.workspace?.name,
    invitedByName: invitation.invitedBy?.name,
    expiresAt: invitation.expiresAt,
  });
}
