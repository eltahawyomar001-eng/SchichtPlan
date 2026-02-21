import NextAuth, { type NextAuthOptions } from "next-auth";
/* eslint-disable @typescript-eslint/no-explicit-any */
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt" },
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
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            workspace: { select: { name: true } },
            employee: { select: { id: true } },
          },
        });

        if (!user || !user.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword,
        );

        if (!isValid) return null;

        // 2FA check: if enabled, verify the TOTP code
        if ((user as any).twoFactorEnabled && (user as any).twoFactorSecret) {
          const totpCode = (credentials as any).totpCode;
          if (!totpCode) {
            throw new Error("2FA_REQUIRED");
          }
          const totp = new OTPAuth.TOTP({
            issuer: "SchichtPlan",
            label: user.email,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromHex(
              Buffer.from((user as any).twoFactorSecret).toString("hex"),
            ),
          });
          const delta = totp.validate({ token: totpCode, window: 1 });
          if (delta === null) {
            throw new Error("2FA_INVALID");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
          workspaceName: user.workspace?.name || null,
          employeeId: user.employee?.id || null,
        };
      },
    }),
  ],
  events: {
    // After PrismaAdapter creates a new OAuth user, auto-create a workspace
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
        const workspace = await prisma.workspace.create({
          data: { name: `${displayName}'s Workspace`, slug },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { workspaceId: workspace.id, role: "OWNER" },
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign-in via credentials — seed the token
      if (user) {
        const authUser = user as SessionUser;
        token.role = authUser.role;
        token.workspaceId = authUser.workspaceId;
        token.workspaceName = authUser.workspaceName;
        token.employeeId = authUser.employeeId;
      }

      // For OAuth sign-ins, bootstrap workspace if missing
      if (account && account.provider !== "credentials" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: {
            workspace: { select: { name: true } },
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
            const workspace = await prisma.workspace.create({
              data: { name: `${displayName}'s Workspace`, slug },
            });
            await prisma.user.update({
              where: { id: token.sub },
              data: { workspaceId: workspace.id, role: "OWNER" },
            });
            token.role = "OWNER";
            token.workspaceId = workspace.id;
            token.workspaceName = workspace.name;
            token.employeeId = null;
          } else {
            token.role = dbUser.role;
            token.workspaceId = dbUser.workspaceId;
            token.workspaceName = dbUser.workspace?.name || null;
            token.employeeId = dbUser.employee?.id || null;
          }
        }
      }

      // Always refresh employeeId from DB so it picks up
      // profiles linked after the initial sign-in
      if (token.sub) {
        const emp = await prisma.employee.findUnique({
          where: { userId: token.sub },
          select: { id: true },
        });
        token.employeeId = emp?.id || null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as SessionUser;
        sessionUser.id = token.sub as string;
        sessionUser.role = token.role as string;
        sessionUser.workspaceId = token.workspaceId as string;
        sessionUser.workspaceName = (token.workspaceName as string) || null;
        sessionUser.employeeId = (token.employeeId as string) || null;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
