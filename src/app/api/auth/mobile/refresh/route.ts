import { parseJsonBody } from "@/lib/api-response";
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
import { withRoute } from "@/lib/with-route";
import { mobileRefreshSchema, validateBody } from "@/lib/validations";
import { isLockedOut } from "@/lib/login-lockout";

function getJwtSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

const ACCESS_TOKEN_TTL = "24h";

export const POST = withRoute(
  "/api/auth/mobile/refresh",
  "POST",
  async (req) => {
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data;
    const parsed = validateBody(mobileRefreshSchema, body);
    if (!parsed.success) return parsed.response;
    const { refreshToken } = parsed.data;

    const jwtSecret = getJwtSecret();

    // ── Refresh-Token verifizieren ──
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(refreshToken, jwtSecret);
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

    // ── Lockout-Prüfung: gesperrte Nutzer dürfen keinen neuen Token erhalten ──
    if (user.email) {
      const lockedSeconds = await isLockedOut(user.email);
      if (lockedSeconds > 0) {
        return NextResponse.json(
          {
            error: `Konto gesperrt. Bitte warte ${Math.ceil(lockedSeconds / 60)} Minute(n).`,
          },
          { status: 429 },
        );
      }
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
      .sign(jwtSecret);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    log.info("Mobile token refresh", { userId: user.id });

    return NextResponse.json({
      token: newAccessToken,
      expiresAt,
    });
  },
);
