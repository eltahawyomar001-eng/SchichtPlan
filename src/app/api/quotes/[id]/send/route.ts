import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { generateAcceptToken } from "@/lib/billing";

/**
 * POST /api/quotes/[id]/send
 *
 * Marks a draft quote as GESENDET and mints a public acceptance token so the
 * customer can confirm it in one click at /angebot/[token].
 */
export const POST = withRoute(
  "/api/quotes/[id]/send",
  "POST",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "update");
    if (forbidden) return forbidden;

    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status !== "ENTWURF" && existing.status !== "GESENDET") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Angebot kann nicht gesendet werden.",
        },
        { status: 409 },
      );
    }

    const acceptToken = existing.acceptToken ?? generateAcceptToken();

    const quote = await prisma.quote.update({
      where: { id },
      data: { status: "GESENDET", acceptToken },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Quote",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { status: "GESENDET" },
    });

    const base = process.env.NEXTAUTH_URL ?? "https://www.shiftfy.de";
    return NextResponse.json({
      ...quote,
      acceptUrl: `${base}/angebot/${acceptToken}`,
    });
  },
);
