import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePlanFeature } from "@/lib/subscription";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * GET /api/chat/channels
 * List all chat channels the current user is a member of.
 */
export async function GET() {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberships = await (prisma as any).chatChannelMember.findMany({
      where: { userId: user.id },
      include: {
        channel: {
          include: {
            _count: { select: { members: true, messages: true } },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" as const },
              select: {
                id: true,
                content: true,
                senderName: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    // Filter to only workspace channels
     
    const channels = memberships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.channel.workspaceId === user.workspaceId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        ...m.channel,
        lastReadAt: m.lastReadAt,
        lastMessage: m.channel.messages[0] ?? null,
        memberCount: m.channel._count.members,
        messageCount: m.channel._count.messages,
        unreadCount:
          m.lastReadAt && m.channel.messages[0]
            ? new Date(m.channel.messages[0].createdAt) > new Date(m.lastReadAt)
              ? 1
              : 0
            : m.channel._count.messages > 0
              ? 1
              : 0,
      }));

    return NextResponse.json(channels);
  } catch (error) {
    log.error("Error fetching chat channels:", { error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

/**
 * POST /api/chat/channels
 * Create a new chat channel.
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const { name, description, type, memberIds, locationId, departmentId } =
      body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 },
      );
    }

    const channelType = type || "GROUP";
    if (!["GROUP", "DIRECT", "LOCATION", "DEPARTMENT"].includes(channelType)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 },
      );
    }

    // Create channel + add creator as member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = await (prisma as any).chatChannel.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type: channelType,
        createdBy: user.id,
        workspaceId: user.workspaceId,
        locationId: locationId || null,
        departmentId: departmentId || null,
        members: {
          create: [
            { userId: user.id },
            // Add additional members
            ...(Array.isArray(memberIds)
              ? memberIds
                  .filter((id: string) => id !== user.id)
                  .map((id: string) => ({ userId: id }))
              : []),
          ],
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "chatChannel",
      entityId: channel.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: user.workspaceId,
    });

    log.info(`[chat] Channel "${name}" created by ${user.email}`);

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    log.error("Error creating chat channel:", { error });
    return NextResponse.json({ error: "Error creating" }, { status: 500 });
  }
}
