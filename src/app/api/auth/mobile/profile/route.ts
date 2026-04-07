/**
 * GET /api/auth/mobile/profile
 *
 * Gibt das aktuelle Benutzerprofil zurück.
 * Wird beim App-Start aufgerufen, um die Sitzung zu validieren.
 * Erwartet: Authorization: Bearer <access_token>
 */

import { NextResponse } from "next/server";
import * as jose from "jose";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-change-me",
);

export const GET = withRoute("/api/auth/mobile/profile", "GET", async (req) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization-Header fehlt." },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);

  // ── Token verifizieren ──
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(token, JWT_SECRET);
    payload = result.payload;
  } catch {
    return NextResponse.json(
      { error: "Ungültiger oder abgelaufener Token." },
      { status: 401 },
    );
  }

  if (payload.type !== "access" || !payload.sub) {
    return NextResponse.json(
      { error: "Ungültiger Token-Typ." },
      { status: 401 },
    );
  }

  // ── Aktuelles Profil aus DB laden ──
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

  log.info("Mobile profile fetch", { userId: user.id });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceName: user.workspace?.name || null,
    employeeId: user.employee?.id || null,
    onboardingCompleted:
      (user.workspace as unknown as { onboardingCompleted?: boolean })
        ?.onboardingCompleted ?? false,
  });
});
