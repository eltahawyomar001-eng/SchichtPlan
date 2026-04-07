import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { updateProfileSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

// ── DELETE /api/profile — Account deletion (Art. 17 DSGVO) ──
export const DELETE = withRoute("/api/profile", "DELETE", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user: authUser } = auth;
  const userId = authUser.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { workspace: { include: { members: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    // If OWNER and sole member → delete entire workspace (cascades everything)
    if (user.role === "OWNER" && user.workspaceId) {
      const otherMembers = user.workspace?.members.filter(
        (m) => m.id !== userId,
      );

      if (!otherMembers || otherMembers.length === 0) {
        // Sole owner — delete entire workspace (all employees, shifts, etc. cascade)
        await tx.workspace.delete({ where: { id: user.workspaceId } });
      } else {
        // Other members exist — cannot delete without transferring ownership
        return { error: "OWNER_TRANSFER_REQUIRED" } as const;
      }
    }

    // Delete user-specific data that won't cascade from workspace
    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    // Finally delete the user
    await tx.user.delete({ where: { id: userId } });
    return { success: true } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  createAuditLog({
    action: "DELETE",
    entityType: "User",
    entityId: userId,
    userId: userId,
    userEmail: authUser.email,
    workspaceId: authUser.workspaceId,
  });

  if (authUser.workspaceId) {
    dispatchWebhook(authUser.workspaceId, "user.deleted", { id: userId }).catch(
      () => {},
    );
  }

  return NextResponse.json({ message: "Account deleted" });
});

export const PATCH = withRoute("/api/profile", "PATCH", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user: authUser } = auth;
  const userId = authUser.id;
  const parsed = validateBody(updateProfileSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Password change
  if (body.currentPassword && body.newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.hashedPassword) {
      return NextResponse.json({ error: "NO_PASSWORD" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(
      body.currentPassword,
      user.hashedPassword,
    );
    if (!isValid) {
      return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "PASSWORD_TOO_SHORT" },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword: hashed },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      userId: userId,
      userEmail: authUser.email,
      workspaceId: authUser.workspaceId,
      metadata: { action: "PASSWORD_CHANGE" },
    });

    if (authUser.workspaceId) {
      dispatchWebhook(authUser.workspaceId, "user.password_changed", {
        id: userId,
      }).catch(() => {});
    }

    return NextResponse.json({ message: "Password updated" });
  }

  // Profile update (name)
  if (body.name !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: body.name },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      userId: userId,
      userEmail: authUser.email,
      workspaceId: authUser.workspaceId,
      changes: { name: body.name },
    });

    if (authUser.workspaceId) {
      dispatchWebhook(authUser.workspaceId, "user.updated", {
        id: userId,
        name: body.name,
      }).catch(() => {});
    }

    return NextResponse.json({ message: "Profile updated" });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
});
