import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, serverError } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

// ─── GET  /api/notifications/status ─────────────────────────────
// Returns unread notification count for the authenticated user.
// Also includes channel config status for OWNER/ADMIN.
export const GET = withRoute(
  "/api/notifications/status",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    const response: Record<string, unknown> = { unreadCount };

    // Admins also get channel config info
    if (user.role === "OWNER" || user.role === "ADMIN") {
      response.email = {
        configured: !!process.env.RESEND_API_KEY,
        provider: "resend",
      };
      response.push = {
        configured:
          !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
          !!process.env.VAPID_PRIVATE_KEY,
        provider: "web-push",
      };
    }

    return NextResponse.json(response);
  },
);
