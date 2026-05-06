import { requireAuth } from "@/lib/api-response";
import { requireManagement } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { generateQrToken } from "@/lib/qr-token";
import { NextResponse } from "next/server";

/**
 * GET /api/qr-clock/token
 *
 * Generate a short-lived (60 s) HMAC-signed token for the QR attendance
 * station. The token embeds the workspaceId so the public punch endpoint
 * can identify which workspace the scan belongs to without exposing a
 * workspace identifier in plaintext.
 *
 * Requires: OWNER | ADMIN | MANAGER
 */
export const GET = withRoute("/api/qr-clock/token", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requireManagement(user);
  if (forbidden) return forbidden;

  const { token, expiresAt } = generateQrToken(workspaceId);
  return NextResponse.json({ token, expiresAt });
});
