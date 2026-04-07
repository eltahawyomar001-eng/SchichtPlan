import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/subscription";
import { requireManagement } from "@/lib/authorization";
import { addChatMembersSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * POST /api/chat/channels/[id]/members
 * Add members to a channel. Creator or management only.
 */
export const POST = withRoute(
  "/api/chat/channels/[id]/members",
  "POST",
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

    // Only creator or management can add members
    if (channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    const parsed = validateBody(addChatMembersSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { userIds } = parsed.data;

    // Verify all users belong to the workspace
    const workspaceUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        workspace: { id: user.workspaceId },
      },
      select: { id: true },
    });

    const validIds = workspaceUsers.map((u) => u.id);

    // Create memberships (skip existing via skipDuplicates)
    const result = await prisma.chatChannelMember.createMany({
      data: validIds.map((userId: string) => ({
        channelId,
        userId,
      })),
      skipDuplicates: true,
    });

    createAuditLog({
      action: "CREATE",
      entityType: "ChatChannelMember",
      entityId: channelId,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { addedUserIds: validIds },
    });

    dispatchWebhook(workspaceId, "chat_member.added", {
      channelId,
      addedUserIds: validIds,
    }).catch(() => {});

    return NextResponse.json({ added: result.count });
  },
  { idempotent: true },
);

/**
 * DELETE /api/chat/channels/[id]/members
 * Remove a member from a channel. Creator, management, or self.
 */
export const DELETE = withRoute(
  "/api/chat/channels/[id]/members",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
    if (planGate) return planGate;

    const { id: channelId } = params;
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId query param required" },
        { status: 400 },
      );
    }

    const channel = await prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId: user.workspaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Can remove yourself, or creator/management can remove others
    if (targetUserId !== user.id && channel.createdBy !== user.id) {
      const mgmtForbidden = requireManagement(user);
      if (mgmtForbidden) return mgmtForbidden;
    }

    await prisma.chatChannelMember.delete({
      where: { channelId_userId: { channelId, userId: targetUserId } },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "ChatChannelMember",
      entityId: channelId,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { removedUserId: targetUserId },
    });

    dispatchWebhook(workspaceId, "chat_member.removed", {
      channelId,
      removedUserId: targetUserId,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
