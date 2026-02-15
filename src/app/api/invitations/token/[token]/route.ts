import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/**
 * GET /api/invitations/token/[token] — get invitation details (public, no auth required)
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
    // Mark as expired
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

/**
 * POST /api/invitations/token/[token] — accept an invitation (requires auth)
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
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

  // Verify email matches
  if (session.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: "EMAIL_MISMATCH" }, { status: 403 });
  }

  // Check if user is already in a workspace
  if (user.workspaceId) {
    return NextResponse.json(
      { error: "ALREADY_IN_WORKSPACE" },
      { status: 409 },
    );
  }

  // Accept: update user workspace + role, mark invitation as accepted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });
  });

  return NextResponse.json({
    success: true,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspace?.name,
    role: invitation.role,
  });
}
