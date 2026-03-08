import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";

// ─── GET  /api/notifications/status ─────────────────────────────
// Returns the configuration status of notification channels.
// Only OWNER/ADMIN can see this (infra details).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const emailConfigured = !!process.env.RESEND_API_KEY;
  const pushConfigured =
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY;

  return NextResponse.json({
    email: {
      configured: emailConfigured,
      provider: "resend",
      ...(emailConfigured
        ? {}
        : { hint: "Set RESEND_API_KEY to enable email notifications" }),
    },
    push: {
      configured: pushConfigured,
      provider: "web-push",
      ...(pushConfigured
        ? {}
        : {
            hint: "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable push notifications",
          }),
    },
  });
}
