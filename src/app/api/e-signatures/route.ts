import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import {
  getSignaturesForEntity,
  verifySignatureIntegrity,
} from "@/lib/e-signature";
import { log } from "@/lib/logger";

/**
 * GET /api/e-signatures?entityType=AbsenceRequest&entityId=xxx
 *
 * Returns all e-signature records for a specific entity.
 * Each record includes an `isValid` field indicating integrity check result.
 *
 * Any authenticated workspace member can view signatures — the workspace
 * scope ensures data isolation, and signatures are read-only audit records.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 },
      );
    }

    const signatures = await getSignaturesForEntity(
      entityType,
      entityId,
      user.workspaceId,
    );

    // Add integrity verification to each record
    const withVerification = signatures.map((sig) => ({
      ...sig,
      isValid: verifySignatureIntegrity(sig),
    }));

    return NextResponse.json(withVerification);
  } catch (error) {
    log.error("Error fetching e-signatures:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
