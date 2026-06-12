/**
 * POST /api/auth/mobile/workspace
 *
 * In-app workspace creation for a freshly signed-up mobile user (OAuth or
 * otherwise) who has no workspace yet. Mirrors the web's registration flow:
 * create the workspace, promote the user to OWNER, auto-create their employee
 * profile, start the trial, and provision a Stripe customer. Returns a FRESH
 * mobile session whose token carries the new workspace/role claims.
 *
 * Auth: Bearer (requireWorkspace: false). Body: { name: string }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJsonBody, requireAuth } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { slugify } from "@/lib/utils";
import { initializeTrial, provisionStripeCustomer } from "@/lib/subscription";
import { buildMobileSession, loadMobileUser } from "@/lib/mobile-auth";

export const POST = withRoute(
  "/api/auth/mobile/workspace",
  "POST",
  async (req) => {
    const auth = await requireAuth({ requireWorkspace: false });
    if (!auth.ok) return auth.response;
    const userId = auth.user.id;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const name = (_json.data as { name?: string }).name?.trim();
    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Bitte gib einen Workspace-Namen an (mind. 2 Zeichen)." },
        { status: 400 },
      );
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 401 },
      );
    }
    if (dbUser.workspaceId) {
      // Already in a workspace — don't silently create a second one.
      return NextResponse.json(
        { error: "ALREADY_IN_WORKSPACE" },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name, slug: slugify(name) + "-" + Date.now().toString(36) },
      });

      await tx.user.update({
        where: { id: userId },
        data: { role: "OWNER", workspaceId: workspace.id },
      });

      // Auto-create the owner's employee profile so they can use shifts/clock.
      const displayName = (dbUser.name || dbUser.email).trim();
      const parts = displayName.split(/\s+/);
      await tx.employee.create({
        data: {
          firstName: parts[0] || displayName,
          lastName: parts.slice(1).join(" ") || "",
          email: dbUser.email,
          userId,
          workspaceId: workspace.id,
        },
      });

      await initializeTrial(tx, workspace.id);
      return workspace;
    });

    // Fire-and-forget Stripe customer provisioning (matches register flow).
    void provisionStripeCustomer(
      result.id,
      dbUser.email,
      dbUser.name ?? dbUser.email,
    );

    const fresh = await loadMobileUser(userId);
    const session = await buildMobileSession(fresh!);
    log.info("Mobile workspace created", { userId, workspaceId: result.id });
    return NextResponse.json(session);
  },
);
