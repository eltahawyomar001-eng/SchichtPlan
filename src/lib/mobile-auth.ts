/**
 * Shared mobile-session minting — used by the mobile login + OAuth + workspace
 * endpoints so they all issue identical JWTs and user payloads.
 *
 * Mirrors POST /api/auth/mobile/login: HS256 access token (24h) carrying the
 * workspace/role claims, plus a long-lived refresh token (30d). The access
 * token's claims are what the Bearer guard (requireAuth) trusts, so they MUST
 * be re-minted whenever the user's workspace/role changes (e.g. after creating
 * a workspace).
 */
import * as jose from "jose";
import { prisma } from "@/lib/db";
import { getMobileEntitlements } from "@/lib/mobile-entitlements";
import type { OAuthIdentity } from "@/lib/oauth-verify";

const ACCESS_TOKEN_TTL = "24h";
const REFRESH_TOKEN_TTL = "30d";

function getJwtSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export interface MobileUserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  workspaceId: string | null;
  workspace?: { name: string | null; onboardingCompleted?: boolean } | null;
  employee?: { id: string } | null;
}

/** Build the flat user object returned by every mobile auth endpoint. */
export async function buildMobileUser(user: MobileUserRecord) {
  const entitlements = await getMobileEntitlements(user.workspaceId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceName: user.workspace?.name ?? null,
    employeeId: user.employee?.id ?? null,
    onboardingCompleted:
      (user.workspace as unknown as { onboardingCompleted?: boolean })
        ?.onboardingCompleted ?? false,
    ...entitlements,
  };
}

/** Mint a fresh { token, refreshToken, expiresAt } pair for a user. */
export async function mintMobileTokens(user: MobileUserRecord) {
  const jwtSecret = getJwtSecret();

  const accessToken = await new jose.SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceName: user.workspace?.name ?? null,
    employeeId: user.employee?.id ?? null,
    type: "access" as const,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(jwtSecret);

  const refreshToken = await new jose.SignJWT({
    sub: user.id,
    type: "refresh" as const,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(jwtSecret);

  return {
    token: accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Full session response: tokens + user + needsWorkspace flag. */
export async function buildMobileSession(user: MobileUserRecord) {
  const [{ token, refreshToken, expiresAt }, userPayload] = await Promise.all([
    mintMobileTokens(user),
    buildMobileUser(user),
  ]);
  return {
    token,
    refreshToken,
    expiresAt,
    user: userPayload,
    needsWorkspace: !user.workspaceId,
  };
}

/** Re-load a user with the includes the helpers expect. */
export function loadMobileUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { workspace: true, employee: { select: { id: true } } },
  });
}

/**
 * Find an existing user by the (verified) OAuth email, or create a new one
 * with NO workspace yet. New users are routed into the in-app "create
 * workspace" onboarding (needsWorkspace: true); the workspace endpoint then
 * promotes them to OWNER of a fresh workspace + trial.
 */
export async function findOrCreateOAuthUser(identity: OAuthIdentity) {
  const existing = await prisma.user.findUnique({
    where: { email: identity.email },
    include: { workspace: true, employee: { select: { id: true } } },
  });

  if (existing) {
    // The provider vouches for the email — backfill verification if missing.
    if (!existing.emailVerified && identity.emailVerified) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: new Date() },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      email: identity.email,
      name: identity.name,
      role: "OWNER", // placeholder until a workspace is created
      emailVerified: identity.emailVerified ? new Date() : null,
    },
    include: { workspace: true, employee: { select: { id: true } } },
  });
}
