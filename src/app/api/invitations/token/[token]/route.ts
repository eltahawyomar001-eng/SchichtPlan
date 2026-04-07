import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * GET /api/invitations/token/[token] — get invitation details (public, no auth required)
 */
export const GET = withRoute(
  "/api/invitations/token/[token]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const { token } = params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "INVITATION_" + invitation.status },
        { status: 410 },
      );
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "INVITATION_EXPIRED" },
        { status: 410 },
      );
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      workspaceName: invitation.workspace?.name,
      invitedByName: invitation.invitedBy?.name,
      expiresAt: invitation.expiresAt,
    });
  },
);

/**
 * POST /api/invitations/token/[token] — accept an invitation (requires auth)
 */
export const POST = withRoute(
  "/api/invitations/token/[token]",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { token } = params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "INVITATION_" + invitation.status },
        { status: 410 },
      );
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "INVITATION_EXPIRED" },
        { status: 410 },
      );
    }

    // Verify email matches
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json({ error: "EMAIL_MISMATCH" }, { status: 403 });
    }

    // Check if user is already in a workspace
    if (user.workspaceId) {
      return NextResponse.json(
        { error: "ALREADY_IN_WORKSPACE" },
        { status: 409 },
      );
    }

    // Accept: update user workspace + role, link/create employee, mark invitation as accepted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      // Auto-link or create an Employee record
      const existingEmployee = await tx.employee.findFirst({
        where: {
          email: { equals: user.email!, mode: "insensitive" },
          workspaceId: invitation.workspaceId,
          userId: null,
        },
      });

      if (existingEmployee) {
        await tx.employee.update({
          where: { id: existingEmployee.id },
          data: { userId: user.id },
        });
      } else {
        // No existing employee — create one and link it
        const displayName = user.name || user.email!;
        const nameParts = displayName.trim().split(/\s+/);
        await tx.employee.create({
          data: {
            firstName: nameParts[0] || displayName,
            lastName: nameParts.slice(1).join(" ") || "",
            email: user.email!,
            userId: user.id,
            workspaceId: invitation.workspaceId,
          },
        });
      }
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Invitation",
      entityId: invitation.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: invitation.workspaceId,
      metadata: { action: "ACCEPTED", role: invitation.role },
    });

    dispatchWebhook(invitation.workspaceId, "invitation.accepted", {
      id: invitation.id,
      role: invitation.role,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace?.name,
      role: invitation.role,
    });
  },
  { idempotent: true },
);
