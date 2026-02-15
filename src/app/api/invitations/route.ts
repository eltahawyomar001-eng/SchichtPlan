import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { randomBytes } from "crypto";
import type { SessionUser } from "@/lib/types";

/**
 * GET /api/invitations — list all invitations for the current workspace
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Only OWNER / ADMIN can view invitations
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(invitations);
}

/**
 * POST /api/invitations — create a new invitation and send email
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Only OWNER / ADMIN can invite
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, role } = await req.json();

  if (!email || !role) {
    return NextResponse.json(
      { error: "Email and role are required" },
      { status: 400 },
    );
  }

  // Validate role — cannot invite as OWNER
  const allowedRoles = ["ADMIN", "MANAGER", "EMPLOYEE"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if user is already a member of this workspace
  const existingMember = await prisma.user.findFirst({
    where: { email, workspaceId: user.workspaceId },
  });

  if (existingMember) {
    return NextResponse.json({ error: "ALREADY_MEMBER" }, { status: 409 });
  }

  // Check for existing pending invitation
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email,
      workspaceId: user.workspaceId,
      status: "PENDING",
    },
  });

  if (existingInvite) {
    return NextResponse.json({ error: "ALREADY_INVITED" }, { status: 409 });
  }

  // Generate secure token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Get workspace name for the email
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { name: true },
  });

  // Create invitation
  const invitation = await prisma.invitation.create({
    data: {
      token,
      email,
      role,
      status: "PENDING",
      expiresAt,
      workspaceId: user.workspaceId,
      invitedById: user.id,
    },
  });

  // Send invitation email
  const inviteLink = `/einladung/${token}`;
  const inviterName = session.user.name || session.user.email || "Someone";
  const workspaceName = workspace?.name || "a workspace";

  await sendEmail({
    to: email,
    type: "INVITATION",
    title: `You've been invited to join ${workspaceName} on SchichtPlan`,
    message: `${inviterName} has invited you to join "${workspaceName}" as ${role.charAt(0) + role.slice(1).toLowerCase()}. Click the button below to accept the invitation. This invitation expires in 7 days.`,
    link: inviteLink,
  });

  return NextResponse.json(invitation, { status: 201 });
}
