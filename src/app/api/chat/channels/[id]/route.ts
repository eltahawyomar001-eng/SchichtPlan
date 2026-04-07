import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/subscription";
import { requireManagement } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { updateChatChannelSchema, validateBody } from "@/lib/validations";

/**
 * GET /api/chat/channels/[id]
 * Channel details with member list.
 */
export const GET = withRoute(
  "/api/chat/channels/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = params;

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Verify membership
    const isMember = channel.members.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.userId === user.id,
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 403 },
      );
    }

    return NextResponse.json(channel);
  },
);

/**
 * PATCH /api/chat/channels/[id]
 * Update channel name/description. Creator or management only.
 */
export const PATCH = withRoute(
  "/api/chat/channels/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = params;

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only creator or management can edit
    if (channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    const body = await req.json();
    const parsed = validateBody(updateChatChannelSchema, body);
    if (!parsed.success) return parsed.response;
    const { data } = parsed;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: updateData,
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "ChatChannel",
      entityId: channelId,
      userId: user.id,
      userEmail: user.email!,
      workspaceId: user.workspaceId,
      changes: updateData,
    });

    dispatchWebhook(user.workspaceId, "chat_channel.updated", {
      id: channelId,
    }).catch(() => {});

    return NextResponse.json(updated);
  },
);

/**
 * DELETE /api/chat/channels/[id]
 * Delete channel. Creator or management only.
 */
export const DELETE = withRoute(
  "/api/chat/channels/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = params;

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only creator or management can delete
    if (channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    // Delete in order: messages → members → channel
    await prisma.chatMessage.deleteMany({ where: { channelId } });
    await prisma.chatChannelMember.deleteMany({
      where: { channelId },
    });
    await prisma.chatChannel.delete({ where: { id: channelId } });

    createAuditLog({
      action: "DELETE",
      entityType: "ChatChannel",
      entityId: channelId,
      userId: user.id,
      userEmail: user.email!,
      workspaceId: user.workspaceId,
      metadata: { channelName: channel.name },
    });

    dispatchWebhook(user.workspaceId, "chat_channel.deleted", {
      id: channelId,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
