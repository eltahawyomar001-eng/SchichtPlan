import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "dev-fallback-secret";

interface StationSetupPayload {
  workspaceId: string;
  type: "station_setup";
  exp: number;
}

interface StationAccessPayload {
  workspaceId: string;
  type: "station_access";
  exp: number;
}

function sign(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verify<T extends { type: string; exp: number }>(
  token: string,
  expectedType: string,
): T | null {
  try {
    const dot = token.indexOf(".");
    if (dot < 0) return null;
    const data = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(data)
      .digest("base64url");
    if (expectedSig !== sig) return null;
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8"),
    ) as T;
    if (payload.type !== expectedType) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** One-time setup link token — valid 24 hours. Admin generates, device visits once. */
export function generateStationSetupToken(workspaceId: string): {
  token: string;
  expiresAt: number;
} {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload: StationSetupPayload = {
    workspaceId,
    type: "station_setup",
    exp,
  };
  return { token: sign(payload), expiresAt: exp };
}

/** Long-lived device credential — valid 30 days. Stored in station localStorage. */
export function generateStationAccessToken(workspaceId: string): {
  token: string;
  expiresAt: number;
} {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload: StationAccessPayload = {
    workspaceId,
    type: "station_access",
    exp,
  };
  return { token: sign(payload), expiresAt: exp };
}

export function verifyStationSetupToken(token: string): string | null {
  return (
    verify<StationSetupPayload>(token, "station_setup")?.workspaceId ?? null
  );
}

export function verifyStationAccessToken(token: string): string | null {
  return (
    verify<StationAccessPayload>(token, "station_access")?.workspaceId ?? null
  );
}
