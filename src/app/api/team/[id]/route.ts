import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateTeamRoleSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * PATCH /api/team/[id] — update a member's role
 */
export const PATCH = withRoute(
  "/api/team/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER can change roles
    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    const parsed = validateBody(updateTeamRoleSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { role } = parsed.data;

    // Cannot change own role
    if (id === user.id) {
      return NextResponse.json(
        { error: "CANNOT_CHANGE_OWN_ROLE" },
        { status: 400 },
      );
    }

    // Cannot assign OWNER role — already enforced by schema
    // Verify target user is in the same workspace
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { workspaceId: true, role: true },
    });

    if (!targetUser || targetUser.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cannot demote another OWNER
    if (targetUser.role === "OWNER") {
      return NextResponse.json(
        { error: "CANNOT_CHANGE_OWNER" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id },
      data: { role },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { role, previousRole: targetUser.role },
    });

    dispatchWebhook(workspaceId, "team_member.updated", {
      id,
      role,
      previousRole: targetUser.role,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);

/**
 * DELETE /api/team/[id] — remove a member from the workspace
 */
export const DELETE = withRoute(
  "/api/team/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER / ADMIN can remove members
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;

    // Cannot remove yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: "CANNOT_REMOVE_SELF" },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { workspaceId: true, role: true },
    });

    if (!targetUser || targetUser.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cannot remove the OWNER
    if (targetUser.role === "OWNER") {
      return NextResponse.json(
        { error: "CANNOT_REMOVE_OWNER" },
        { status: 400 },
      );
    }

    // ADMIN cannot remove another ADMIN
    if (user.role === "ADMIN" && targetUser.role === "ADMIN") {
      return NextResponse.json(
        { error: "CANNOT_REMOVE_ADMIN" },
        { status: 403 },
      );
    }

    // Remove from workspace (set workspaceId to null, role to OWNER for future use)
    await prisma.user.update({
      where: { id },
      data: { workspaceId: null, role: "OWNER" },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "User",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "remove-from-workspace" },
    });

    dispatchWebhook(workspaceId, "team_member.removed", { id }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
