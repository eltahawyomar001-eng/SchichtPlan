import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { createICalTokenSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * GET /api/ical/tokens
 * List user's iCal tokens.
 */
export const GET = withRoute("/api/ical/tokens", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

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
});

/**
 * POST /api/ical/tokens
 * Generate a new iCal subscription token.
 * Body: { label?: string }
 *
 * Returns the full token exactly once — it cannot be retrieved again.
 */
export const POST = withRoute(
  "/api/ical/tokens",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

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

    createAuditLog({
      action: "CREATE",
      entityType: "iCalToken",
      entityId: record.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

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
  },
  { idempotent: true },
);

/**
 * DELETE /api/ical/tokens
 * Revoke an iCal token.
 * Body: { id: string }
 */
export const DELETE = withRoute("/api/ical/tokens", "DELETE", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

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

  createAuditLog({
    action: "DELETE",
    entityType: "iCalToken",
    entityId: tokenId,
    userId: user.id,
    userEmail: user.email,
    workspaceId,
  });

  log.info(`[ical] Token revoked: id=${tokenId}, user=${user.id}`);

  return NextResponse.json({ success: true });
});
