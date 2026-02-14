import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── PATCH  /api/absences/[id] ──────────────────────────────────
// Used for approve / reject / cancel
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.absenceRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.status) {
      data.status = body.status;
      if (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") {
        data.reviewedBy = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = body.reviewNote || null;
      }
    }

    const updated = await prisma.absenceRequest.update({
      where: { id },
      data,
      include: { employee: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating absence:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 },
    );
  }
}

// ─── DELETE  /api/absences/[id] ─────────────────────────────────
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    const existing = await prisma.absenceRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.absenceRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting absence:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
