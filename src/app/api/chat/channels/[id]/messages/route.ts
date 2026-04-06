import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { sanitize } from "@/lib/sanitize";
import { createChatMessageSchema, validateBody } from "@/lib/validations";
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
    const membership = await prisma.chatChannelMember.findUnique({
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
      where.parentId = null; // Top-level messages only
    }

    const messages = await prisma.chatMessage.findMany({
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
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
          },
        },
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

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    // Update lastReadAt
    await prisma.chatChannelMember.update({
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
    const membership = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = validateBody(createChatMessageSchema, body);
    if (!parsed.success) return parsed.response;
    const content = parsed.data.content;
    const parentId = parsed.data.parentId || null;

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitize(content);

    const message = await prisma.chatMessage.create({
      data: {
        content: sanitizedContent,
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
    await prisma.chatChannelMember.update({
      where: { channelId_userId: { channelId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    // Fire-and-forget: notify all other channel members via bell
    void (async () => {
      try {
        const [channel, members] = await Promise.all([
          prisma.chatChannel.findUnique({
            where: { id: channelId },
            select: { name: true, workspaceId: true },
          }),
          prisma.chatChannelMember.findMany({
            where: { channelId, userId: { not: user.id } },
            select: { userId: true },
          }),
        ]);

        if (!channel || members.length === 0) return;

        const preview =
          sanitizedContent.length > 80
            ? sanitizedContent.slice(0, 80) + "…"
            : sanitizedContent;

        await prisma.notification.createMany({
          data: members.map((m) => ({
            userId: m.userId,
            workspaceId: channel.workspaceId,
            type: "CHAT_MESSAGE",
            title: `Neue Nachricht in ${channel.name}`,
            message: `${user.name || user.email}: ${preview}`,
            link: `/nachrichten?channel=${channelId}`,
          })),
        });
      } catch (err) {
        log.error("Failed to notify channel members", {
          channelId,
          error: err,
        });
      }
    })();

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    log.error("Error sending message:", { error });
    return NextResponse.json({ error: "Error sending" }, { status: 500 });
  }
}
