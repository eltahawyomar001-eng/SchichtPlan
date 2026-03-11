import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { randomBytes } from "crypto";
import { createICalTokenSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

/**
 * GET /api/ical/tokens
 * List user's iCal tokens.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const tokens = await prisma.iCalToken.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      lastUsedAt: true,
      rotatedAt: true,
      expiresAt: true,
      createdAt: true,
      // Intentionally not returning the full token for security
      token: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Mask tokens — only show last 8 chars
  const masked = tokens.map((t) => ({
    ...t,
    token: `…${t.token.slice(-8)}`,
  }));

  return NextResponse.json({ data: masked });
}

/**
 * POST /api/ical/tokens
 * Generate a new iCal subscription token.
 * Body: { label?: string }
 *
 * Returns the full token exactly once — it cannot be retrieved again.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const parsed = validateBody(
    createICalTokenSchema,
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) return parsed.response;
  const label = parsed.data.label ?? null;

  // 48 random bytes → 64-char hex token (cryptographically strong)
  const token = randomBytes(48).toString("hex");

  // Hard expiry at 180 days — tokens rotate at 90 days automatically
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const record = await prisma.iCalToken.create({
    data: {
      token,
      userId: user.id,
      workspaceId: user.workspaceId,
      label,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://app.shiftfy.de";
  const feedUrl = `${baseUrl}/api/ical?token=${token}`;

  log.info(
    `[ical] Token created for user=${user.id}, label="${label || "none"}"`,
  );

  return NextResponse.json(
    {
      id: record.id,
      token, // Shown exactly once
      feedUrl,
      label: record.label,
      createdAt: record.createdAt,
    },
    { status: 201 },
  );
}

/**
 * DELETE /api/ical/tokens
 * Revoke an iCal token.
 * Body: { id: string }
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const body = await req.json().catch(() => ({}));
  const tokenId = body.id;

  if (!tokenId || typeof tokenId !== "string") {
    return NextResponse.json({ error: "Missing token id" }, { status: 400 });
  }

  // Only allow deleting own tokens
  const existing = await prisma.iCalToken.findFirst({
    where: { id: tokenId, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await prisma.iCalToken.delete({ where: { id: tokenId } });

  log.info(`[ical] Token revoked: id=${tokenId}, user=${user.id}`);

  return NextResponse.json({ success: true });
}
