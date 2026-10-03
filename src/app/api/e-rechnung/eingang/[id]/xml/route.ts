import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/e-rechnung/eingang/[id]/xml — the original, as received.
 *
 * § 147 AO requires a received document to be retained in the form it
 * arrived, so this serves the stored bytes untouched. The tax office asking
 * for the original is the whole reason the column exists.
 */
export const GET = withRoute(
  "/api/e-rechnung/eingang/[id]/xml",
  "GET",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const row = await prisma.incomingInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { xml: true, number: true, fileName: true, sha256: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const filename = row.fileName ?? `ERechnung_${row.number ?? id}.xml`;

    return new Response(row.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "X-Invoice-Checksum": row.sha256,
      },
    });
  },
);
