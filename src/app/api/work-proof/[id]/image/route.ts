import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { isManagement } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { createPhotoReadUrl } from "@/lib/work-proof-storage";

/**
 * GET /api/work-proof/[id]/image
 *
 * Stream one proof photo from our own origin.
 *
 * The list endpoint hands out signed storage URLs that live ten minutes, which
 * is right for rendering a page and wrong for everything else. The PDF export
 * read those same URLs at click time, so an export started more than ten
 * minutes after the page loaded produced a document full of "Foto konnte nicht
 * geladen werden" -- the metadata intact, the evidence missing, which is the
 * one part that mattered.
 *
 * Serving the bytes ourselves removes the expiry, removes any cross-origin
 * question, and gives a single-photo download somewhere to point at. The
 * trade is that the bytes pass through the app rather than going straight from
 * storage to the browser; at a few hundred kilobytes a photo that is well
 * worth it for an export that has to be right.
 */

export const GET = withRoute(
  "/api/work-proof/[id]/image",
  "GET",
  async (req, context) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    const { id } = await context!.params;

    /**
     * An employee may only read their own proof.
     *
     * These photos show workplaces and sometimes people, so the scope is
     * decided here from the session rather than taken from the request. A
     * manager sees the whole workspace because reviewing the round is the
     * entire point for them.
     */
    let ownEmployeeId: string | null = null;
    if (!isManagement(user)) {
      const me = await prisma.employee.findFirst({
        where: { workspaceId, userId: user.id },
        select: { id: true },
      });
      if (!me)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      ownEmployeeId = me.id;
    }

    const photo = await prisma.workProofPhoto.findFirst({
      where: {
        id,
        workspaceId,
        ...(ownEmployeeId ? { employeeId: ownEmployeeId } : {}),
      },
      select: { storagePath: true, fileType: true, fileName: true },
    });
    if (!photo)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const signed = await createPhotoReadUrl(photo.storagePath);
    if (!signed) {
      return NextResponse.json(
        { error: "Storage unavailable" },
        { status: 502 },
      );
    }

    const upstream = await fetch(signed);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Storage unavailable" },
        { status: 502 },
      );
    }

    const filename = photo.fileName?.replace(/["\\]/g, "") || `${id}.jpg`;
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": photo.fileType || "image/jpeg",
        // inline so an <img> can use it; the download attribute on the link
        // still controls the filename when someone saves it deliberately.
        "Content-Disposition": `inline; filename="${filename}"`,
        // private: the URL is stable, so a shared cache must never hold an
        // image one workspace is allowed to see and another is not.
        "Cache-Control": "private, max-age=300",
      },
    });
  },
);
