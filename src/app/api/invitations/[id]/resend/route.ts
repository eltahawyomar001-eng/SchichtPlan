import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { randomBytes } from "crypto";
import type { SessionUser } from "@/lib/types";

/**
 * POST /api/invitations/[id]/resend — resend an invitation email with a fresh token
 */
export async function POST(
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
    include: { workspace: { select: { name: true } } },
  });

  if (!invitation || invitation.workspaceId !== user.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only pending invitations can be resent" },
      { status: 400 },
    );
  }

  // Generate a new token and extend expiry
  const newToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.update({
    where: { id },
    data: { token: newToken, expiresAt },
  });

  // Send email
  const inviteLink = `/einladung/${newToken}`;
  const inviterName = session.user.name || session.user.email || "Someone";
  const workspaceName = invitation.workspace?.name || "a workspace";

  await sendEmail({
    to: invitation.email,
    type: "INVITATION",
    title: `Reminder: You've been invited to join ${workspaceName} on SchichtPlan`,
    message: `${inviterName} has reminded you about your invitation to join "${workspaceName}" as ${invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase()}. Click the button below to accept. This invitation expires in 7 days.`,
    link: inviteLink,
  });

  return NextResponse.json({ success: true });
}
