import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { log } from "@/lib/logger";

// German Bundesländer (federal states)
const VALID_BUNDESLAENDER = [
  "BW", // Baden-Württemberg
  "BY", // Bayern
  "BE", // Berlin
  "BB", // Brandenburg
  "HB", // Bremen
  "HH", // Hamburg
  "HE", // Hessen
  "MV", // Mecklenburg-Vorpommern
  "NI", // Niedersachsen
  "NW", // Nordrhein-Westfalen
  "RP", // Rheinland-Pfalz
  "SL", // Saarland
  "SN", // Sachsen
  "ST", // Sachsen-Anhalt
  "SH", // Schleswig-Holstein
  "TH", // Thüringen
];

/**
 * GET /api/workspace
 * Returns the current workspace settings.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    if (!user.workspaceId)
      return NextResponse.json({ error: "No workspace" }, { status: 400 });

    const workspace = await prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        bundesland: true,
        createdAt: true,
      },
    });

    if (!workspace)
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );

    return NextResponse.json(workspace);
  } catch (error) {
    log.error("Error fetching workspace:", { error });
    return NextResponse.json(
      { error: "Error loading workspace" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspace
 * Update workspace settings (name, bundesland, industry).
 * Only OWNER and ADMIN can update.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    if (!user.workspaceId)
      return NextResponse.json({ error: "No workspace" }, { status: 400 });

    const authError = requireAdmin(user);
    if (authError) return authError;

    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      data.name = body.name.trim();
    }

    if (typeof body.industry === "string") {
      data.industry = body.industry.trim() || null;
    }

    if (typeof body.bundesland === "string") {
      if (body.bundesland === "" || body.bundesland === null) {
        data.bundesland = null;
      } else if (VALID_BUNDESLAENDER.includes(body.bundesland)) {
        data.bundesland = body.bundesland;
      } else {
        return NextResponse.json(
          { error: "Ungültiges Bundesland." },
          { status: 400 },
        );
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Keine Änderungen angegeben." },
        { status: 400 },
      );
    }

    const updated = await prisma.workspace.update({
      where: { id: user.workspaceId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        bundesland: true,
      },
    });

    log.info("Workspace updated", {
      workspaceId: user.workspaceId,
      userId: user.id,
      changes: Object.keys(data),
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error updating workspace:", { error });
    return NextResponse.json(
      { error: "Error updating workspace" },
      { status: 500 },
    );
  }
}
