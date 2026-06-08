import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin-auth";

/**
 * GET /api/super-admin/me
 * Lightweight check so the client (e.g. the sidebar) can decide whether to
 * surface the Super Admin entry. Returns { isSuperAdmin: boolean } and never
 * leaks why — non-admins simply get false.
 */
export async function GET() {
  return NextResponse.json({ isSuperAdmin: await isSuperAdmin() });
}
