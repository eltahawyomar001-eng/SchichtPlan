import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * GET /api/chat/stream?channelId=…
 *
 * SSE stream that pushes new messages to the client in near-real-time.
 * Replaces the 5-second full message polling with a 1.5-second
 * incremental check for new messages only.
 *
 * Events sent:
 *   - message:new      — new message(s) in the channel
 *   - message:deleted   — a message was soft-deleted
 *   - channels:update  — message count changed
 *   - ping             — keepalive every 25s
 *
 * Typing indicators and read receipts remain as lightweight client polls
 * because typing state is in-memory on the origin server and cannot be
 * shared across SSE connections on a serverless platform.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return new Response("Missing channelId", { status: 400 });
  }

  // Verify membership
  const membership = await prisma.chatChannelMember.findUnique({
    where: {
      channelId_userId: { channelId, userId: user.id },
    },
  });

  if (!membership) {
    return new Response("Not a member", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      // Send initial ping
      send("ping", { ts: Date.now() });

      // Track state for change detection
      let lastKnownCreatedAt: Date | null = null;
      let lastMessageCount = 0;

      // Establish baseline
      const latestMsg = await prisma.chatMessage.findFirst({
        where: { channelId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (latestMsg) lastKnownCreatedAt = latestMsg.createdAt;

      lastMessageCount = await prisma.chatMessage.count({
        where: { channelId, deletedAt: null },
      });

      // Poll function — checks for new messages and pushes SSE events
      const pollForChanges = async () => {
        if (closed) return;

        try {
          // 1. Check for new messages (created after our last known)
          if (lastKnownCreatedAt) {
            const newMessages = await prisma.chatMessage.findMany({
              where: {
                channelId,
                deletedAt: null,
                createdAt: { gt: lastKnownCreatedAt },
              },
              include: {
                sender: { select: { id: true, name: true, image: true } },
              },
              orderBy: { createdAt: "asc" },
            });

            if (newMessages.length > 0) {
              send("message:new", { messages: newMessages });
              lastKnownCreatedAt =
                newMessages[newMessages.length - 1].createdAt;
            }
          }

          // 2. Check for count changes (deletions)
          const currentCount = await prisma.chatMessage.count({
            where: { channelId, deletedAt: null },
          });
          if (currentCount !== lastMessageCount) {
            send("channels:update", {
              channelId,
              messageCount: currentCount,
            });
            lastMessageCount = currentCount;
          }
        } catch (err) {
          if (!closed) {
            log.error("[chat/stream] Poll error:", { error: err });
          }
        }
      };

      // Server-side poll every 1.5s — much more efficient than client polling
      // because it's a single DB query instead of a full HTTP round-trip
      const pollInterval = setInterval(pollForChanges, 1500);

      // Keepalive ping every 25s (Vercel has 30s proxy timeout for SSE)
      const pingInterval = setInterval(() => {
        send("ping", { ts: Date.now() });
      }, 25000);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(pingInterval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
