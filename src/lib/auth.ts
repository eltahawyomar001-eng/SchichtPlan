import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import AppleProvider from "next-auth/providers/apple";
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
import { initializeTrial, provisionStripeCustomer } from "@/lib/subscription";
import { log } from "@/lib/logger";

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
            // The iOS app creates OAuth users by verified email only (no NextAuth
            // Account row — see findOrCreateOAuthUser). Without this, a web
            // "Continue with Google" for an iOS-created account throws
            // OAuthAccountNotLinked and bounces back to /login. Google verifies
            // the email, so linking by it is safe.
            allowDangerousEmailAccountLinking: true,
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
            // Link to an existing verified-email user (e.g. created by the iOS
            // app) instead of throwing OAuthAccountNotLinked. See Google above.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    // OAuth: Sign in with Apple (web). Uses a "Services ID" as the client id
    // and a pre-generated ES256 client-secret JWT (see APPLE setup in the env
    // docs; rotate the secret before its ≤6-month expiry). A new Apple account
    // flows through the same createUser path as Google/Azure → a workspace is
    // auto-provisioned and the user becomes OWNER.
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
            // Accounts created via the iOS app's native Apple sign-in exist as a
            // verified-email user with NO NextAuth Account row. Without this,
            // "Continue with Apple" on web throws OAuthAccountNotLinked and
            // silently redirects back to /login. Apple verifies the email (and
            // the private-relay address is stable per developer team), so
            // linking by it is safe. See Google above.
            allowDangerousEmailAccountLinking: true,
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
    // After PrismaAdapter creates a new OAuth user, bootstrap workspace + employee + trial.
    // Wrapped in try/catch because NextAuth swallows event errors silently — the JWT
    // callback has a repair path, but logging here makes failures visible.
    async createUser({ user }) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { workspaceId: true, name: true, email: true },
        });
        if (dbUser && !dbUser.workspaceId && dbUser.email) {
          const displayName =
            dbUser.name || dbUser.email.split("@")[0] || "Mein Unternehmen";

          // Check for a pending invitation before creating a standalone workspace.
          // When an invited user clicks the invitation link and authenticates via OAuth,
          // NextAuth has no mechanism to carry the invitation token through the OAuth
          // redirect — we detect the invitation by matching the verified email address.
          const invitation = await prisma.invitation.findFirst({
            where: {
              email: { equals: dbUser.email, mode: "insensitive" },
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" }, // most recent wins when multiple exist
          });

          if (invitation) {
            // Join the inviting workspace instead of bootstrapping a standalone one
            const nameParts = displayName.trim().split(/\s+/);
            await prisma.$transaction(async (tx) => {
              // Race-safe claim: only the request that flips PENDING→ACCEPTED
              // proceeds. If a concurrent flow (e.g. the credentials register
              // route) already consumed this invitation, abort — the JWT
              // callback repair path re-evaluates and assigns a workspace.
              const claim = await tx.invitation.updateMany({
                where: { id: invitation.id, status: "PENDING" },
                data: { status: "ACCEPTED" },
              });
              if (claim.count === 0) {
                throw new Error("INVITATION_RACE_LOST");
              }
              await tx.user.update({
                where: { id: user.id },
                data: {
                  workspaceId: invitation.workspaceId,
                  role: invitation.role,
                },
              });
              // Link to existing pre-created employee or create one
              const existing = await tx.employee.findFirst({
                where: {
                  email: { equals: dbUser.email!, mode: "insensitive" },
                  workspaceId: invitation.workspaceId,
                  userId: null,
                },
              });
              if (existing) {
                await tx.employee.update({
                  where: { id: existing.id },
                  data: { userId: user.id },
                });
              } else {
                await tx.employee.create({
                  data: {
                    firstName: nameParts[0] || displayName,
                    lastName: nameParts.slice(1).join(" ") || "",
                    email: dbUser.email!,
                    userId: user.id,
                    workspaceId: invitation.workspaceId,
                    isActive: true,
                  },
                });
              }
            });
            // Flag as new OAuth user so /oauth-welcome can show "account created" UI
            await cache
              .set(`new_oauth_reg:${user.id}`, "1", 300)
              .catch(() => {});
            log.info(
              "[auth] createUser: new OAuth user joined via invitation",
              { userId: user.id, workspaceId: invitation.workspaceId },
            );
          } else {
            // No pending invitation — create standalone workspace
            const slug =
              displayName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") +
              "-" +
              user.id.slice(-6);

            let newWorkspaceId: string | null = null;
            await prisma.$transaction(async (tx) => {
              const workspace = await tx.workspace.create({
                data: { name: `${displayName}'s Workspace`, slug },
              });
              newWorkspaceId = workspace.id;
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

            // Provision Stripe customer now so stripeCustomerId exists at
            // checkout time (fire & forget — failure never blocks sign-in)
            if (newWorkspaceId) {
              void provisionStripeCustomer(
                newWorkspaceId,
                dbUser.email ?? "",
                dbUser.name ?? displayName,
              ).catch(() => {});
            }

            // Flag as new OAuth user so /oauth-welcome can show "account created" UI
            await cache
              .set(`new_oauth_reg:${user.id}`, "1", 300)
              .catch(() => {});
          }
        }
      } catch (err) {
        // The JWT callback will repair workspace/trial on the first sign-in.
        log.error("[auth] createUser event failed — JWT callback will repair", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
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
          select: {
            workspaceId: true,
            hashedPassword: true,
            emailVerified: true,
            workspace: { select: { createdAt: true } },
          },
        });

        // OAuth providers (Google, Azure AD) verify the user's email address before
        // issuing a token. NextAuth's callback-handler.js creates every OAuth user with
        // emailVerified: null regardless of what the provider attests — correct this so
        // credential sign-in isn't permanently blocked if the user later adds a password
        // via the forgot-password flow.
        if (dbUser && !dbUser.emailVerified) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            });
          } catch {
            /* best-effort — not sign-in-blocking */
          }
        }

        // OAuth-claiming-credentials protection is handled by NextAuth itself:
        // when getUserByEmail finds an existing user but getUserByAccount finds
        // no Account for this provider, NextAuth returns OAuthAccountNotLinked
        // BEFORE signIn is called — so no further check is needed here.
        //
        // WARNING: if allowDangerousEmailAccountLinking is ever added to the
        // NextAuth config, that protection disappears and must be re-implemented
        // at the adapter level (override linkAccount, not here in signIn, because
        // the Account row is created before signIn fires).

        if (dbUser?.workspaceId) {
          // Wrapped in try/catch: a transient DB error here must never block
          // sign-in — the JWT callback has the identical repair path as fallback.
          try {
            const sub = await prisma.subscription.findUnique({
              where: { workspaceId: dbUser.workspaceId },
            });
            if (!sub) {
              await initializeTrial(
                prisma as Parameters<typeof initializeTrial>[0],
                dbUser.workspaceId,
              );
            } else if (
              sub.status === "INCOMPLETE" &&
              !sub.stripeSubscriptionId
            ) {
              // Base trial on workspace creation date, not now — prevents
              // re-gifting a fresh trial to workspaces that already expired.
              const trialStart = dbUser.workspace?.createdAt ?? new Date();
              const trialEnd = new Date(trialStart);
              trialEnd.setDate(trialEnd.getDate() + 7);
              await prisma.subscription.update({
                where: { workspaceId: dbUser.workspaceId },
                data: { status: "TRIALING", trialStart, trialEnd },
              });
            }
          } catch (err) {
            log.error(
              "[auth] signIn subscription repair failed — JWT will retry",
              {
                userId: user.id,
                workspaceId: dbUser.workspaceId,
                error: err instanceof Error ? err.message : String(err),
              },
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
      // freshFromOAuth signals that this block ran and set token values from a
      // fresh DB read — the cache block below must be skipped so it cannot
      // overwrite those values with a stale 60-second-old cache entry.
      let freshFromOAuth = false;
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

            // Same invitation check as in createUser — this is the repair path
            // for when createUser failed. Without the check, the repair would
            // silently create a standalone workspace for a user who should have
            // joined an invited workspace.
            const invitation = dbUser.email
              ? await prisma.invitation.findFirst({
                  where: {
                    email: { equals: dbUser.email, mode: "insensitive" },
                    status: "PENDING",
                    expiresAt: { gt: new Date() },
                  },
                  orderBy: { createdAt: "desc" },
                })
              : null;

            if (invitation) {
              // Join invited workspace
              let joinedEmployeeId: string | null = null;
              const nameParts = (dbUser.name || "").trim().split(/\s+/);
              // Race-safe claim. Returns false if a concurrent flow already
              // consumed this invitation — in that case the winner has already
              // set this user's workspace, so we re-read instead of throwing
              // (throwing here would abort sign-in) or creating a standalone.
              const joined = await prisma.$transaction(async (tx) => {
                const claim = await tx.invitation.updateMany({
                  where: { id: invitation.id, status: "PENDING" },
                  data: { status: "ACCEPTED" },
                });
                if (claim.count === 0) {
                  return false;
                }
                await tx.user.update({
                  where: { id: token.sub as string },
                  data: {
                    workspaceId: invitation.workspaceId,
                    role: invitation.role,
                  },
                });
                const existing = await tx.employee.findFirst({
                  where: {
                    email: { equals: dbUser.email!, mode: "insensitive" },
                    workspaceId: invitation.workspaceId,
                    userId: null,
                  },
                });
                if (existing) {
                  await tx.employee.update({
                    where: { id: existing.id },
                    data: { userId: token.sub as string },
                  });
                  joinedEmployeeId = existing.id;
                } else {
                  const emp = await tx.employee.create({
                    data: {
                      firstName: nameParts[0] || displayName,
                      lastName: nameParts.slice(1).join(" ") || "",
                      email: dbUser.email ?? "",
                      userId: token.sub as string,
                      workspaceId: invitation.workspaceId,
                      isActive: true,
                    },
                  });
                  joinedEmployeeId = emp.id;
                }
                return true;
              });

              if (joined) {
                const invWs = await prisma.workspace.findUnique({
                  where: { id: invitation.workspaceId },
                  select: { name: true, onboardingCompleted: true },
                });
                token.role = invitation.role;
                token.workspaceId = invitation.workspaceId;
                token.workspaceName = invWs?.name || null;
                token.employeeId = joinedEmployeeId;
                token.onboardingCompleted = invWs?.onboardingCompleted ?? false;
              } else {
                // Lost the race — re-read the workspace the winner assigned.
                const fresh = await prisma.user.findUnique({
                  where: { id: token.sub as string },
                  include: {
                    workspace: {
                      select: { name: true, onboardingCompleted: true },
                    },
                    employee: { select: { id: true } },
                  },
                });
                token.role = fresh?.role ?? invitation.role;
                token.workspaceId = fresh?.workspaceId ?? null;
                token.workspaceName = fresh?.workspace?.name ?? null;
                token.employeeId = fresh?.employee?.id ?? null;
                token.onboardingCompleted =
                  fresh?.workspace?.onboardingCompleted ?? false;
              }
            } else {
              // No invitation — create standalone workspace (repair path)
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

              if (newWorkspaceId) {
                void provisionStripeCustomer(
                  newWorkspaceId,
                  dbUser.email ?? "",
                  dbUser.name ?? displayName,
                ).catch(() => {});
              }
            }
          } else {
            token.role = dbUser.role;
            token.workspaceId = dbUser.workspaceId;
            token.workspaceName = dbUser.workspace?.name || null;
            token.employeeId = dbUser.employee?.id || null;
            token.onboardingCompleted =
              (dbUser.workspace as unknown as WorkspaceWithOnboarding | null)
                ?.onboardingCompleted ?? false;

            // Repair missing employee — createUser event may have rolled back
            // after creating the workspace but before persisting the employee.
            if (dbUser.workspaceId && !dbUser.employee) {
              try {
                const nameParts = (dbUser.name || "").trim().split(/\s+/);
                const emp = await prisma.employee.create({
                  data: {
                    firstName: nameParts[0] || dbUser.name || "User",
                    lastName: nameParts.slice(1).join(" ") || "",
                    email: dbUser.email ?? "",
                    userId: token.sub as string,
                    workspaceId: dbUser.workspaceId,
                    isActive: true,
                  },
                });
                token.employeeId = emp.id;
              } catch (err) {
                log.error("[auth] JWT employee repair failed", {
                  userId: token.sub,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }

            // Repair: workspace exists but subscription may be missing or orphaned.
            if (dbUser.workspaceId) {
              const sub = await prisma.subscription.findUnique({
                where: { workspaceId: dbUser.workspaceId },
                select: { status: true, stripeSubscriptionId: true },
              });
              if (!sub) {
                await initializeTrial(
                  prisma as Parameters<typeof initializeTrial>[0],
                  dbUser.workspaceId,
                );
              } else if (
                sub.status === "INCOMPLETE" &&
                !sub.stripeSubscriptionId
              ) {
                const trialStart =
                  (dbUser.workspace as { createdAt?: Date } | null)
                    ?.createdAt ?? new Date();
                const trialEnd = new Date(trialStart);
                trialEnd.setDate(trialEnd.getDate() + 7);
                await prisma.subscription.update({
                  where: { workspaceId: dbUser.workspaceId },
                  data: { status: "TRIALING", trialStart, trialEnd },
                });
              }
            }
          }
        }
        freshFromOAuth = true;
      }

      // Refresh employeeId, workspaceId, and role from DB with a 60-second TTL
      // cache. Skipped when the account block above already read fresh DB state —
      // running both would let a stale cache entry overwrite the fresh values.
      if (!freshFromOAuth && token.sub) {
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
