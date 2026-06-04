import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";
import { cache } from "@/lib/cache";
import { invitationTokenLookups } from "@/lib/invitation-token";

/**
 * GET /api/invitations/token/[token] — get invitation details (public, no auth required)
 */
export const GET = withRoute(
  "/api/invitations/token/[token]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const { token } = params;

    const invitation = await prisma.invitation.findFirst({
      where: { token: { in: invitationTokenLookups(token) } },
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
    const { user } = auth;

    const { token } = params;

    const invitation = await prisma.invitation.findFirst({
      where: { token: { in: invitationTokenLookups(token) } },
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

    // If the user already has a workspace, only allow re-homing when they are
    // the sole member (the auto-created OAuth onboarding workspace scenario).
    // Users in a shared workspace cannot silently leave it via an invitation.
    if (user.workspaceId) {
      const memberCount = await prisma.user.count({
        where: { workspaceId: user.workspaceId },
      });
      if (memberCount > 1) {
        return NextResponse.json(
          { error: "ALREADY_IN_WORKSPACE" },
          { status: 409 },
        );
      }
      // Sole owner of their workspace — proceed with re-homing below.
      // The old workspace is kept for data safety; its trial subscription
      // will expire naturally.
    }

    // Accept: update user workspace + role, link/create employee, mark invitation as accepted.
    // Race-safe: the status check above is a TOCTOU pre-check only. The authoritative
    // guard is the conditional updateMany INSIDE the transaction — only one concurrent
    // request can flip PENDING→ACCEPTED, and the loser (count === 0) aborts before any
    // user/employee writes run. Prevents a double-click or two browser tabs from both
    // joining and emitting two PINs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accepted = await prisma.$transaction(async (tx: any) => {
      const claim = await tx.invitation.updateMany({
        where: { id: invitation.id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (claim.count === 0) {
        // Another request already accepted this invitation — bail out, no writes.
        return false;
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
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
        const displayName = (user as SessionUser).name || user.email!;
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
      return true;
    });

    if (!accepted) {
      // Lost the accept race — the invitation was already consumed by a
      // concurrent request. The user is (or is about to be) in the workspace,
      // so surface a clear, non-fatal status rather than a 500.
      return NextResponse.json(
        { error: "INVITATION_ACCEPTED" },
        { status: 409 },
      );
    }

    // Invalidate the cached JWT so the next session read reflects the new
    // workspace/role immediately instead of serving the stale 60s-TTL entry.
    // The client also calls session.update(), but busting here makes the new
    // workspace authoritative even for concurrent server-side reads.
    await cache.del(`jwt:${user.id}`).catch(() => {});

    // ── PIN generation (fire & forget) ──
    (async () => {
      try {
        const emp = await prisma.employee.findFirst({
          where: {
            email: { equals: user.email!, mode: "insensitive" },
            workspaceId: invitation.workspaceId,
            pinHash: null,
          },
          select: { id: true, firstName: true },
        });
        if (emp) {
          const rawPin = await generateUniquePin(invitation.workspaceId);
          const pHash = hashPin(invitation.workspaceId, rawPin);
          await prisma.employee.update({
            where: { id: emp.id },
            data: { pinHash: pHash },
          });
          const ws = await prisma.workspace.findUnique({
            where: { id: invitation.workspaceId },
            select: { name: true },
          });
          await sendPinEmail({
            to: user.email!,
            firstName: emp.firstName,
            rawPin,
            workspaceName: ws?.name ?? "",
          });
        }
      } catch (err) {
        // Non-fatal — employee can still punch via admin assignment
        console.error("[invitations] PIN generation failed", err);
      }
    })();

    return NextResponse.json({
      success: true,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace?.name,
      role: invitation.role,
    });
  },
  { idempotent: true },
);
