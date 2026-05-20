import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { prisma } from "@/lib/db";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { cache } from "@/lib/cache";
import type { SessionUser } from "@/lib/types";
import {
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
} from "@/lib/login-lockout";
import { initializeTrial } from "@/lib/subscription";

/** Workspace shape that includes the onboardingCompleted field.
 *  Used for casting until moduleResolution:bundler fully resolves
 *  the Prisma 7 generated client types. */
interface WorkspaceWithOnboarding {
  onboardingCompleted: boolean;
  [key: string]: unknown;
}

/** Compare a plain-text recovery code against an array of bcrypt hashes. */
async function findMatchingRecoveryCode(
  plainCode: string,
  hashedCodes: string[],
): Promise<number | null> {
  const normalized = plainCode.replace(/[\s-]/g, "").toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) return i;
  }
  return null;
}

/* ── JWT role-refresh cache ── */
// Avoid hitting DB on every single request — cache user data for 60s.
// Uses Redis-backed cache (src/lib/cache.ts) so data survives
// serverless cold-starts and is shared across instances.
const JWT_REFRESH_TTL_S = 60; // seconds

interface JwtCacheEntry {
  name: string | null;
  role: string;
  workspaceId: string | null;
  workspaceName: string | null;
  employeeId: string | null;
  onboardingCompleted: boolean;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 /* 1 hour */,
    updateAge: 5 * 60 /* refresh token every 5 minutes */,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    // OAuth: Google
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // OAuth: Microsoft Azure AD
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID || "common",
          }),
        ]
      : []),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // ── Brute-force lockout check (DSGVO Art. 32) ──
        const lockedSeconds = await isLockedOut(credentials.email);
        if (lockedSeconds > 0) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            workspace: true,
            employee: { select: { id: true } },
          },
        });

        if (!user || !user.hashedPassword) {
          await recordFailedAttempt(credentials.email);
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword,
        );

        if (!isValid) {
          await recordFailedAttempt(credentials.email);
          return null;
        }

        // Block unverified email accounts
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // 2FA check: if enabled, verify the TOTP code or recovery code
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const totpCode = credentials.totpCode;
          if (!totpCode) {
            throw new Error("2FA_REQUIRED");
          }

          // Try TOTP validation first (window: 2 = ±60 s tolerance)
          const rawSecret = user.twoFactorSecret;
          const hexSecret = isEncrypted(rawSecret)
            ? decrypt(rawSecret)
            : rawSecret; // backward-compat with unencrypted secrets
          const secret = OTPAuth.Secret.fromHex(hexSecret);
          const totp = new OTPAuth.TOTP({
            issuer: "Shiftfy",
            label: user.email,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret,
          });
          const delta = totp.validate({ token: totpCode, window: 2 });

          if (delta === null) {
            // TOTP failed — try recovery code
            const recoveryCodes = user.twoFactorRecoveryCodes;
            if (recoveryCodes) {
              const codes: string[] = JSON.parse(recoveryCodes);
              const hashedMatch = await findMatchingRecoveryCode(
                totpCode,
                codes,
              );
              if (hashedMatch !== null) {
                // Remove used recovery code
                codes.splice(hashedMatch, 1);

                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    twoFactorRecoveryCodes: JSON.stringify(codes),
                  },
                });
              } else {
                throw new Error("2FA_INVALID");
              }
            } else {
              throw new Error("2FA_INVALID");
            }
          }
        }

        // Successful auth → clear lockout counters
        await clearFailedAttempts(credentials.email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
          workspaceName: user.workspace?.name || null,
          employeeId: user.employee?.id || null,
          onboardingCompleted:
            (user.workspace as unknown as WorkspaceWithOnboarding | null)
              ?.onboardingCompleted ?? false,
        };
      },
    }),
  ],
  events: {
    // After PrismaAdapter creates a new OAuth user, bootstrap workspace + employee + trial
    async createUser({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { workspaceId: true, name: true, email: true },
      });
      if (dbUser && !dbUser.workspaceId) {
        const displayName =
          dbUser.name || dbUser.email?.split("@")[0] || "Mein Unternehmen";
        const slug =
          displayName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          user.id.slice(-6);

        await prisma.$transaction(async (tx) => {
          const workspace = await tx.workspace.create({
            data: { name: `${displayName}'s Workspace`, slug },
          });
          await tx.user.update({
            where: { id: user.id },
            data: { workspaceId: workspace.id, role: "OWNER" },
          });

          // Auto-create Employee profile so punch-clock works immediately
          const nameParts = (dbUser.name || "").trim().split(/\s+/);
          await tx.employee.create({
            data: {
              firstName: nameParts[0] || displayName,
              lastName: nameParts.slice(1).join(" ") || "",
              email: dbUser.email ?? "",
              userId: user.id,
              workspaceId: workspace.id,
              isActive: true,
            },
          });

          await initializeTrial(tx, workspace.id);
        });
      }
    },
  },
  callbacks: {
    // Runs after PrismaAdapter upserts the user, before any JWT is issued.
    // For OAuth sign-ins, guarantees a subscription row exists so the user
    // never freezes on the onboarding activation screen.
    async signIn({ user, account }) {
      if (account?.type === "oauth") {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { workspaceId: true },
        });
        if (dbUser?.workspaceId) {
          const sub = await prisma.subscription.findUnique({
            where: { workspaceId: dbUser.workspaceId },
          });
          if (!sub) {
            // createUser event failed to create the trial — repair it now.
            await initializeTrial(
              prisma as Parameters<typeof initializeTrial>[0],
              dbUser.workspaceId,
            );
          }
        }
      }
      return true;
    },

    async jwt({ token, user, account, trigger, session: updateData }) {
      // Client-side session update (e.g. profile name change)
      if (trigger === "update" && updateData) {
        if (updateData.name !== undefined) {
          token.name = updateData.name;
        }
        // Bust the JWT cache so stale data doesn't overwrite
        if (token.sub) {
          await cache.del(`jwt:${token.sub}`);
        }
        return token;
      }

      // Initial sign-in via credentials — seed the token
      if (user) {
        const authUser = user as SessionUser;
        token.role = authUser.role;
        token.workspaceId = authUser.workspaceId;
        token.workspaceName = authUser.workspaceName;
        token.employeeId = authUser.employeeId;
        token.onboardingCompleted = authUser.onboardingCompleted ?? false;
      }

      // For OAuth sign-ins, bootstrap workspace if missing.
      // This is a safety net: the createUser event should run first and do
      // this atomically, but if it failed mid-transaction the JWT callback
      // repairs the state — including the trial subscription that the old
      // fallback was missing (root cause of subscription-less ghost accounts).
      if (account && account.provider !== "credentials" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: {
            workspace: true,
            employee: { select: { id: true } },
          },
        });
        if (dbUser) {
          if (!dbUser.workspaceId) {
            const displayName =
              dbUser.name || dbUser.email?.split("@")[0] || "Mein Unternehmen";
            const slug =
              displayName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") +
              "-" +
              token.sub.slice(-6);

            // Full workspace bootstrap in one atomic transaction —
            // same as createUser event but with initializeTrial included.
            let newWorkspaceId: string | null = null;
            let newEmployeeId: string | null = null;
            await prisma.$transaction(async (tx) => {
              const workspace = await tx.workspace.create({
                data: { name: `${displayName}'s Workspace`, slug },
              });
              newWorkspaceId = workspace.id;
              await tx.user.update({
                where: { id: token.sub as string },
                data: { workspaceId: workspace.id, role: "OWNER" },
              });
              const nameParts = (dbUser.name || "").trim().split(/\s+/);
              const emp = await tx.employee.create({
                data: {
                  firstName: nameParts[0] || displayName,
                  lastName: nameParts.slice(1).join(" ") || "",
                  email: dbUser.email ?? "",
                  userId: token.sub as string,
                  workspaceId: workspace.id,
                  isActive: true,
                },
              });
              newEmployeeId = emp.id;
              await initializeTrial(tx, workspace.id);
            });

            token.role = "OWNER";
            token.workspaceId = newWorkspaceId;
            token.workspaceName = `${displayName}'s Workspace`;
            token.employeeId = newEmployeeId;
            token.onboardingCompleted = false;
          } else {
            token.role = dbUser.role;
            token.workspaceId = dbUser.workspaceId;
            token.workspaceName = dbUser.workspace?.name || null;
            token.employeeId = dbUser.employee?.id || null;
            token.onboardingCompleted =
              (dbUser.workspace as unknown as WorkspaceWithOnboarding | null)
                ?.onboardingCompleted ?? false;
          }
        }
      }

      // Refresh employeeId, workspaceId, and role from DB
      // with a 60-second TTL cache to avoid a DB query on every
      // single request while still picking up role/workspace changes.
      if (token.sub) {
        const cacheKey = `jwt:${token.sub}`;
        const cached = await cache.get<JwtCacheEntry>(cacheKey);
        if (cached) {
          token.name = cached.name;
          token.role = cached.role;
          token.workspaceId = cached.workspaceId;
          token.workspaceName = cached.workspaceName;
          token.employeeId = cached.employeeId;
          token.onboardingCompleted = cached.onboardingCompleted;
        } else {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              name: true,
              role: true,
              workspaceId: true,
              workspace: true,
              employee: { select: { id: true } },
            },
          });
          if (dbUser) {
            const ws =
              dbUser.workspace as unknown as WorkspaceWithOnboarding | null;
            token.name = dbUser.name;
            token.role = dbUser.role;
            token.workspaceId = dbUser.workspaceId;
            token.workspaceName = dbUser.workspace?.name || null;
            token.employeeId = dbUser.employee?.id || null;
            token.onboardingCompleted = ws?.onboardingCompleted ?? false;
            await cache.set(
              cacheKey,
              {
                name: dbUser.name,
                role: dbUser.role,
                workspaceId: dbUser.workspaceId,
                workspaceName: dbUser.workspace?.name || null,
                employeeId: dbUser.employee?.id || null,
                onboardingCompleted: ws?.onboardingCompleted ?? false,
              } satisfies JwtCacheEntry,
              JWT_REFRESH_TTL_S,
            );
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as SessionUser;
        sessionUser.id = token.sub as string;
        sessionUser.name = (token.name as string) || "";
        sessionUser.role = token.role as string;
        sessionUser.workspaceId = token.workspaceId as string;
        sessionUser.workspaceName = (token.workspaceName as string) || null;
        sessionUser.employeeId = (token.employeeId as string) || null;
        sessionUser.onboardingCompleted =
          (token.onboardingCompleted as boolean) ?? false;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
