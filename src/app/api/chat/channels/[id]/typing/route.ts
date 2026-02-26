import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

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

    const { id: channelId } = await params;

    // Verify membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = await (prisma as any).chatChannelMember.findUnique({
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
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/**
 * GET /api/chat/channels/[id]/typing
 * Get list of users currently typing in this channel.
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
    const { id: channelId } = await params;

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
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
