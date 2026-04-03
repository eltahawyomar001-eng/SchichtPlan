/**
 * POST /api/auth/mobile/refresh
 *
 * Token-Erneuerung — Nimmt einen Refresh-Token und gibt einen neuen Access-Token zurück.
 * Das Benutzerprofil wird aus der DB aktualisiert (Rollenwechsel etc.).
 */

import { NextResponse } from "next/server";
import * as jose from "jose";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-change-me",
);
const ACCESS_TOKEN_TTL = "24h";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { refreshToken } = body as { refreshToken?: string };

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh-Token erforderlich." },
        { status: 400 },
      );
    }

    // ── Refresh-Token verifizieren ──
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(refreshToken, JWT_SECRET);
      payload = result.payload;
    } catch {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Refresh-Token." },
        { status: 401 },
      );
    }

    if (payload.type !== "refresh" || !payload.sub) {
      return NextResponse.json(
        { error: "Ungültiger Token-Typ." },
        { status: 401 },
      );
    }

    // ── Benutzer aus DB laden (aktuelle Daten) ──
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        workspace: true,
        employee: { select: { id: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 401 },
      );
    }

    // ── Neuen Access-Token generieren ──
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspaceId,
      workspaceName: user.workspace?.name || null,
      employeeId: user.employee?.id || null,
      type: "access" as const,
    };

    const newAccessToken = await new jose.SignJWT(tokenPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(JWT_SECRET);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    log.info("Mobile token refresh", { userId: user.id });

    return NextResponse.json({
      token: newAccessToken,
      expiresAt,
    });
  } catch (error) {
    log.error("Mobile token refresh error", { error });
    return NextResponse.json(
      { error: "Token-Erneuerung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
