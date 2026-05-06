import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "dev-fallback-secret";
const TTL_MS = 60_000; // 60 seconds

interface QrPayload {
  workspaceId: string;
  type: "qr_clock";
  exp: number; // epoch ms
}

/** Create a short-lived HMAC-signed token embedding workspaceId. */
export function generateQrToken(workspaceId: string): {
  token: string;
  expiresAt: number;
} {
  const exp = Date.now() + TTL_MS;
  const payload: QrPayload = { workspaceId, type: "qr_clock", exp };
  const data = JSON.stringify(payload);
  const dataB64 = Buffer.from(data).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(dataB64)
    .digest("base64url");
  return { token: `${dataB64}.${sig}`, expiresAt: exp };
}

/** Verify token signature and expiry. Returns workspaceId or null. */
export function verifyQrToken(token: string): string | null {
  try {
    const dot = token.indexOf(".");
    if (dot < 0) return null;
    const dataB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(dataB64)
      .digest("base64url");
    if (expectedSig !== sig) return null;

    const payload: QrPayload = JSON.parse(
      Buffer.from(dataB64, "base64url").toString("utf-8"),
    );
    if (payload.type !== "qr_clock") return null;
    if (payload.exp < Date.now()) return null; // expired

    return payload.workspaceId;
  } catch {
    return null;
  }
}
