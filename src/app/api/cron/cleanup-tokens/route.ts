import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/cron/cleanup-tokens
 *
 * Deletes expired PasswordResetTokens and PinRevealTokens.
 * Runs via Vercel Cron daily at 03:30 UTC.
 */
export const GET = withRoute("/api/cron/cleanup-tokens", "GET", async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");

  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  const now = new Date();

  const resetTokens = await prisma.passwordResetToken.deleteMany({
    where: { expires: { lt: now } },
  });

  log.info("[cron/cleanup-tokens] done", {
    resetTokensDeleted: resetTokens.count,
  });

  return NextResponse.json({ resetTokensDeleted: resetTokens.count });
});
