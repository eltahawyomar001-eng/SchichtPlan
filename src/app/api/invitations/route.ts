import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { invitationEmail } from "@/lib/notifications/email-i18n";
import { randomBytes } from "crypto";
import { createInvitationSchema, validateBody } from "@/lib/validations";
import { requireUserSlot } from "@/lib/subscription-guard";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { getLocaleFromCookie } from "@/i18n/locale";

/**
 * GET /api/invitations — list all invitations for the current workspace
 */
export const GET = withRoute("/api/invitations", "GET", async (_req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

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
});

/**
 * POST /api/invitations — create a new invitation and send email
 */
export const POST = withRoute(
  "/api/invitations",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    // Only OWNER / ADMIN can invite
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check user slot limit (employees + pending invitations)
    const slotLimit = await requireUserSlot(user.workspaceId);
    if (slotLimit) return slotLimit;

    const body = await req.json();
    const parsed = validateBody(createInvitationSchema, body);
    if (!parsed.success) return parsed.response;
    const { email, role } = parsed.data;

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
    const inviterName = user.name || user.email || "Someone";
    const workspaceName = workspace?.name || "a workspace";
    const locale = await getLocaleFromCookie();
    const copy = invitationEmail(locale, inviterName, workspaceName, role);

    await sendEmail({
      to: email,
      type: "invitation",
      title: copy.subject,
      message: copy.body,
      link: inviteLink,
      locale,
    });

    return NextResponse.json(invitation, { status: 201 });
  },
  { idempotent: true },
);
