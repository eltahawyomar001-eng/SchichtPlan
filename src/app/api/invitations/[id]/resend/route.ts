import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { invitationReminderEmail } from "@/lib/notifications/email-i18n";
import { randomBytes } from "crypto";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { getLocaleFromCookie } from "@/i18n/locale";

/**
 * POST /api/invitations/[id]/resend — resend an invitation email with a fresh token
 */
export const POST = withRoute(
  "/api/invitations/[id]/resend",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;

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
    const inviterName = user.name || user.email || "Someone";
    const workspaceName = invitation.workspace?.name || "a workspace";
    const locale = await getLocaleFromCookie();
    const copy = invitationReminderEmail(
      locale,
      inviterName,
      workspaceName,
      invitation.role,
    );

    await sendEmail({
      to: invitation.email,
      type: "invitation",
      title: copy.subject,
      message: copy.body,
      link: inviteLink,
      locale,
    });

    return NextResponse.json({ success: true });
  },
  { idempotent: true },
);
