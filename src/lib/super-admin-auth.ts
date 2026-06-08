import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

function getSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function isSuperAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  return getSuperAdminEmails().has(session.user.email.toLowerCase());
}

/** The authenticated super-admin's identity, or null if the caller isn't one. */
export interface SuperAdminIdentity {
  userId?: string;
  email: string;
}

/**
 * Returns the calling super-admin's identity (for audit trails), or null.
 * Use in routes that need to record *who* performed a privileged action.
 */
export async function getSuperAdminIdentity(): Promise<SuperAdminIdentity | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  if (!getSuperAdminEmails().has(email.toLowerCase())) return null;
  const userId = (session.user as { id?: string }).id;
  return { userId, email };
}

/**
 * API route guard — returns 401/403 if the caller is not a super-admin.
 * Returns null when the check passes.
 */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getSuperAdminEmails().has(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
