import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";

/**
 * GET /api/cron/cleanup-tokens
 *
 * Deletes expired PasswordResetTokens and PinRevealTokens.
 * Runs via Vercel Cron daily at 03:30 UTC.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");

  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  try {
    const now = new Date();

    const resetTokens = await prisma.passwordResetToken.deleteMany({
      where: { expires: { lt: now } },
    });

    log.info("[cron/cleanup-tokens] done", {
      resetTokensDeleted: resetTokens.count,
    });

    return NextResponse.json({ resetTokensDeleted: resetTokens.count });
  } catch (err) {
    captureRouteError(err, {
      route: "/api/cron/cleanup-tokens",
      method: "GET",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
