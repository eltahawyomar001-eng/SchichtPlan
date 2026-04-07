import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { randomBytes } from "crypto";
import { createInvitationSchema, validateBody } from "@/lib/validations";
import { requireUserSlot } from "@/lib/subscription-guard";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * GET /api/invitations — list all invitations for the current workspace
 */
export const GET = withRoute("/api/invitations", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  // Only OWNER / ADMIN can view invitations
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { take, skip } = parsePagination(req);
  const where = { workspaceId: user.workspaceId };

  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  return paginatedResponse(invitations, total, take, skip);
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
    const { user, workspaceId } = auth;

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

    await sendEmail({
      to: email,
      type: "INVITATION",
      title: `You've been invited to join ${workspaceName} on Shiftfy`,
      message: `${inviterName} has invited you to join "${workspaceName}" as ${role.charAt(0) + role.slice(1).toLowerCase()}. Click the button below to accept the invitation. This invitation expires in 7 days.`,
      link: inviteLink,
    });

    createAuditLog({
      action: "CREATE",
      entityType: "Invitation",
      entityId: invitation.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { email, role },
    });

    dispatchWebhook(workspaceId, "invitation.created", {
      id: invitation.id,
      email,
      role,
    }).catch(() => {});

    return NextResponse.json(invitation, { status: 201 });
  },
  { idempotent: true },
);
