import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * GET /api/chat/channels/[id]/read-receipts
 * Get read receipts (lastReadAt) for all members in the channel.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { id: channelId } = await params;

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
  } catch (error) {
    log.error("Error fetching read receipts:", { error });
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
