import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { invitationTokenLookups } from "@/lib/invitation-token";

/**
 * GET /api/auth/invitation/[token] — public endpoint to get invitation details
 * No authentication required — used by the invitation accept page to show details
 */
export const GET = withRoute(
  "/api/auth/invitation/[token]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const { token } = params;

    const invitation = await prisma.invitation.findFirst({
      where: { token: { in: invitationTokenLookups(token) } },
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
      return NextResponse.json(
        { error: "INVITATION_EXPIRED" },
        { status: 410 },
      );
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      workspaceName: invitation.workspace?.name,
      invitedByName: invitation.invitedBy?.name,
      expiresAt: invitation.expiresAt,
    });
  },
);
