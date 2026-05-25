import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";

/**
 * DELETE /api/account
 *
 * GDPR Art. 17 — Right to Erasure ("right to be forgotten").
 *
 * Behaviour:
 *  - OWNER of a workspace cannot self-delete (would orphan workspace data).
 *    They must transfer ownership or close the workspace via billing first.
 *  - Non-owner deletes their User row. Cascades remove their Employee profile,
 *    sessions, accounts, push subscriptions, and notification prefs.
 *  - Time entries, audit logs, invoices remain (legally retained under GoBD
 *    §147 — 10 years for financial records, ArbZG for time entries).
 *    Personal identifiers on those rows are anonymized at the model level
 *    where the relation is `onDelete: SetNull`.
 *
 * Confirmation: requires a `confirmation` body field equal to the user's email
 * to prevent accidental clicks.
 */
export const DELETE = withRoute("/api/account", "DELETE", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const confirmation = (body as { confirmation?: string }).confirmation;

  if (confirmation !== user.email) {
    return NextResponse.json(
      {
        error: "CONFIRMATION_MISMATCH",
        message: "Bitte bestätigen Sie die Löschung mit Ihrer E-Mail-Adresse.",
      },
      { status: 400 },
    );
  }

  if (user.role === "OWNER") {
    return NextResponse.json(
      {
        error: "OWNER_CANNOT_SELF_DELETE",
        message:
          "Als Workspace-Inhaber können Sie sich nicht selbst löschen. Übertragen Sie zuerst den Besitz oder kündigen Sie das Abonnement.",
      },
      { status: 409 },
    );
  }

  log.info("[GDPR:Erasure] account deletion requested", {
    userId: user.id,
    workspaceId: user.workspaceId,
  });

  // Bust JWT role cache before deleting so no token can be re-used
  await cache.del(`jwt:${user.id}`).catch(() => {});

  await prisma.user.delete({ where: { id: user.id } });

  log.info("[GDPR:Erasure] account deleted", {
    userId: user.id,
    workspaceId: user.workspaceId,
  });

  // Tell the client to clear the session cookie immediately
  const res = NextResponse.json({ success: true });
  res.headers.set(
    "Set-Cookie",
    "next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0, __Secure-next-auth.session-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  return res;
});
