import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * In-memory typing state.
 * Maps channelId → Map<userId, { name, expiresAt }>
 *
 * Entries expire after 4 seconds. No DB overhead.
 */
const typingState = new Map<
  string,
  Map<string, { name: string; expiresAt: number }>
>();

/**
 * POST /api/chat/channels/[id]/typing
 * Signal that the current user is typing.
 */
export const POST = withRoute(
  "/api/chat/channels/[id]/typing",
  "POST",
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

    // Set typing state (expires in 4 seconds)
    if (!typingState.has(channelId)) {
      typingState.set(channelId, new Map());
    }
    const channelTyping = typingState.get(channelId)!;
    channelTyping.set(user.id, {
      name: user.name || user.email || "Unknown",
      expiresAt: Date.now() + 4000,
    });

    return NextResponse.json({ ok: true });
  },
);

/**
 * GET /api/chat/channels/[id]/typing
 * Get list of users currently typing in this channel.
 */
export const GET = withRoute(
  "/api/chat/channels/[id]/typing",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id: channelId } = params;

    const channelTyping = typingState.get(channelId);
    if (!channelTyping) {
      return NextResponse.json({ typing: [] });
    }

    // Clean expired entries and return active typers (excluding self)
    const now = Date.now();
    const active: Array<{ userId: string; name: string }> = [];

    for (const [userId, entry] of channelTyping.entries()) {
      if (entry.expiresAt < now) {
        channelTyping.delete(userId);
      } else if (userId !== user.id) {
        active.push({ userId, name: entry.name });
      }
    }

    return NextResponse.json({ typing: active });
  },
);
