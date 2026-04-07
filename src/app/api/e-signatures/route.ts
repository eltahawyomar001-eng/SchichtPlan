import { NextResponse } from "next/server";
import {
  getSignaturesForEntity,
  verifySignatureIntegrity,
} from "@/lib/e-signature";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/e-signatures?entityType=AbsenceRequest&entityId=xxx
 *
 * Returns all e-signature records for a specific entity.
 * Each record includes an `isValid` field indicating integrity check result.
 *
 * Any authenticated workspace member can view signatures — the workspace
 * scope ensures data isolation, and signatures are read-only audit records.
 */
export const GET = withRoute("/api/e-signatures", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

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
});
