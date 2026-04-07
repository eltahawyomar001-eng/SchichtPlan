import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { updateWorkspaceSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

// German Bundesländer (federal states) — used for reference / future validation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
export const GET = withRoute("/api/workspace", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
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
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return NextResponse.json(workspace);
});

/**
 * PATCH /api/workspace
 * Update workspace settings (name, bundesland, industry).
 * Only OWNER and ADMIN can update.
 */
export const PATCH = withRoute("/api/workspace", "PATCH", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const authError = requireAdmin(user);
  if (authError) return authError;

  const parsed = validateBody(updateWorkspaceSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    data.name = body.name.trim();
  }

  if (typeof body.industry === "string") {
    data.industry = body.industry.trim() || null;
  }

  if (typeof body.bundesland === "string") {
    if (body.bundesland === "") {
      data.bundesland = null;
    } else {
      data.bundesland = body.bundesland;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Keine Änderungen angegeben." },
      { status: 400 },
    );
  }

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
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
    workspaceId,
    userId: user.id,
    changes: Object.keys(data),
  });

  dispatchWebhook(workspaceId, "workspace.updated", {
    id: workspaceId,
    ...data,
  }).catch(() => {});

  return NextResponse.json(updated);
});

/**
 * DELETE /api/workspace
 *
 * Permanently delete the workspace and all associated data.
 * Only the OWNER can perform this action.
 * Requires confirmation body: { confirmName: "<workspace name>" }
 *
 * This removes ALL workspace data (employees, shifts, time entries,
 * absences, subscriptions, etc.) via Prisma onDelete: Cascade.
 * Members are detached (workspaceId set to null) so they keep
 * their user accounts.
 */
export const DELETE = withRoute("/api/workspace", "DELETE", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  // Only the OWNER can delete the workspace
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { confirmName } = body;

  if (!confirmName || typeof confirmName !== "string") {
    return NextResponse.json(
      { error: "Bitte geben Sie den Workspace-Namen zur Bestätigung ein." },
      { status: 400 },
    );
  }

  // Fetch workspace to verify name matches
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { id: true, name: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (confirmName.trim() !== workspace.name) {
    return NextResponse.json(
      { error: "CONFIRMATION_MISMATCH" },
      { status: 400 },
    );
  }

  const workspaceName = workspace.name;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    // 1. Detach all members (keep their user accounts)
    await tx.user.updateMany({
      where: { workspaceId },
      data: { workspaceId: null, role: "OWNER" },
    });

    // 2. Delete workspace (cascades all related data)
    await tx.workspace.delete({ where: { id: workspaceId } });
  });

  log.info(
    `[workspace/DELETE] Workspace "${workspaceName}" (${workspaceId}) deleted by ${user.email}`,
  );

  createAuditLog({
    action: "DELETE",
    entityType: "workspace",
    entityId: workspaceId,
    userId: user.id,
    userEmail: user.email ?? undefined,
    workspaceId,
    metadata: { workspaceName },
  });

  return NextResponse.json({ success: true });
});
