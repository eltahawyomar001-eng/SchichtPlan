import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/chat/channels/[id]/read-receipts
 * Get read receipts (lastReadAt) for all members in the channel.
 */
export const GET = withRoute(
  "/api/chat/channels/[id]/read-receipts",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id: channelId } = params;

    // Verify membership
    const membership = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const members = await prisma.chatChannelMember.findMany({
      where: { channelId },
      select: {
        userId: true,
        lastReadAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(
      members
        .filter((m: { userId: string }) => m.userId !== user.id)
        .map(
          (m: {
            userId: string;
            lastReadAt: Date | null;
            user: {
              id: string;
              name: string | null;
              email: string;
              image: string | null;
            };
          }) => ({
            userId: m.userId,
            name: m.user.name || m.user.email,
            image: m.user.image,
            lastReadAt: m.lastReadAt,
          }),
        ),
    );
  },
);
