import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";

/**
 * GET /api/chat/channels/[id]/messages
 * Paginated messages for a channel (newest first).
 */
export async function GET(
  req: Request,
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

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = await params;

    // Verify user is a member of this channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = await (prisma as any).chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const search = searchParams.get("search")?.trim();
    const pinnedOnly = searchParams.get("pinned") === "true";
    const parentId = searchParams.get("parentId"); // For thread replies

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { channelId };

    if (search) {
      where.content = { contains: search, mode: "insensitive" };
      where.deletedAt = null;
    }
    if (pinnedOnly) {
      where.pinnedAt = { not: null };
    }
    if (parentId) {
      where.parentId = parentId; // Thread replies
    } else if (!search && !pinnedOnly) {
      where.parentId = null; // Top-level messages only (not thread replies)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = await (prisma as any).chatMessage.findMany({
      where,
      orderBy: { createdAt: parentId ? ("asc" as const) : ("desc" as const) },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        content: true,
        senderName: true,
        senderId: true,
        editedAt: true,
        deletedAt: true,
        pinnedAt: true,
        pinnedBy: true,
        parentId: true,
        createdAt: true,
        _count: { select: { replies: true } },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    // Update lastReadAt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).chatChannelMember.update({
      where: { channelId_userId: { channelId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({
      messages,
      hasMore,
      nextCursor: hasMore ? messages[messages.length - 1]?.id : null,
    });
  } catch (error) {
    log.error("Error fetching messages:", { error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

/**
 * POST /api/chat/channels/[id]/messages
 * Send a message to a channel.
 */
export async function POST(
  req: Request,
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

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = await params;

    // Verify user is a member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = await (prisma as any).chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const content = body.content?.trim();
    const parentId = body.parentId || null;

    if (!content || content.length > 5000) {
      return NextResponse.json(
        { error: "Message must be 1-5000 characters" },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await (prisma as any).chatMessage.create({
      data: {
        content,
        channelId,
        senderId: user.id,
        senderName: user.name || user.email,
        parentId,
      },
      select: {
        id: true,
        content: true,
        senderName: true,
        senderId: true,
        parentId: true,
        createdAt: true,
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
          },
        },
      },
    });

    // Update sender's lastReadAt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).chatChannelMember.update({
      where: { channelId_userId: { channelId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    log.error("Error sending message:", { error });
    return NextResponse.json({ error: "Error sending" }, { status: 500 });
  }
}
