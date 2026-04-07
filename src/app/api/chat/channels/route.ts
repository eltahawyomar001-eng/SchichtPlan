import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/subscription";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { createChatChannelSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/chat/channels
 * List all chat channels the current user is a member of.
 */
export const GET = withRoute("/api/chat/channels", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
  if (planGate) return planGate;

  const memberships = await prisma.chatChannelMember.findMany({
    where: {
      userId: user.id,
      channel: { workspaceId: user.workspaceId },
    },
    include: {
      channel: {
        include: {
          _count: { select: { members: true, messages: true } },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              content: true,
              senderName: true,
              createdAt: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  const channels = memberships
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => {
      const lastMsg = m.channel.messages[0] ?? null;
      const lastMsgContent = lastMsg?.deletedAt
        ? "[Nachricht gelöscht]"
        : lastMsg?.content;
      return {
        ...m.channel,
        lastReadAt: m.lastReadAt,
        lastMessage: lastMsg ? { ...lastMsg, content: lastMsgContent } : null,
        memberCount: m.channel._count.members,
        messageCount: m.channel._count.messages,
        unreadCount:
          m.lastReadAt && lastMsg
            ? new Date(lastMsg.createdAt) > new Date(m.lastReadAt)
              ? 1
              : 0
            : m.channel._count.messages > 0
              ? 1
              : 0,
      };
    });

  return NextResponse.json(channels);
});

/**
 * POST /api/chat/channels
 * Create a new chat channel.
 */
export const POST = withRoute(
  "/api/chat/channels",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const parsed = validateBody(createChatChannelSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, description, type, memberIds, locationId, departmentId } =
      parsed.data;

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
    const channel = await prisma.chatChannel.create({
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

    dispatchWebhook(user.workspaceId, "chat_channel.created", {
      id: channel.id,
      name,
    }).catch(() => {});

    log.info(`[chat] Channel "${name}" created by ${user.email}`);

    return NextResponse.json(channel, { status: 201 });
  },
  { idempotent: true },
);
