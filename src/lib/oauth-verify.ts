/**
 * Native OAuth token verification for the mobile app.
 *
 * The iOS app performs the Google / Apple sign-in natively and sends us the
 * resulting **ID token** (a signed JWT). We verify its signature against the
 * provider's published JWKS and check issuer + audience, then trust the email.
 * No client secret is needed for verifying native ID tokens.
 *
 * Env:
 *   GOOGLE_CLIENT_ID       — existing web client (accepted as an audience)
 *   GOOGLE_IOS_CLIENT_ID   — iOS OAuth client created in Google Cloud Console
 *   APPLE_BUNDLE_ID        — the app's bundle id (audience), default de.shiftfy.mobile
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export interface OAuthIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
  sub: string;
}

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<OAuthIdentity> {
  const audiences = [
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
  ].filter(Boolean) as string[];
  if (audiences.length === 0) {
    throw new Error("No Google client IDs configured");
  }

  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences,
  });

  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) throw new Error("Google token has no email");

  return {
    email: email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    sub: String(payload.sub),
  };
}

export async function verifyAppleIdToken(
  identityToken: string,
  fullName?: string | null,
): Promise<OAuthIdentity> {
  const audience = process.env.APPLE_BUNDLE_ID || "de.shiftfy.mobile";

  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience,
  });

  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) throw new Error("Apple token has no email");

  // Apple only returns email_verified as the string "true"/"false".
  const verified =
    payload.email_verified === true || payload.email_verified === "true";

  return {
    email: email.toLowerCase(),
    emailVerified: verified,
    name: fullName?.trim() || null, // Apple only sends the name on first auth
    sub: String(payload.sub),
  };
}
