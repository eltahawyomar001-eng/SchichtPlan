import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/**
 * PATCH /api/team/[id] — update a member's role
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Only OWNER can change roles
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await req.json();

  // Cannot change own role
  if (id === user.id) {
    return NextResponse.json(
      { error: "CANNOT_CHANGE_OWN_ROLE" },
      { status: 400 },
    );
  }

  // Cannot assign OWNER role
  if (role === "OWNER") {
    return NextResponse.json({ error: "CANNOT_ASSIGN_OWNER" }, { status: 400 });
  }

  const allowedRoles = ["ADMIN", "MANAGER", "EMPLOYEE"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "CANNOT_CHANGE_OWNER" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id },
    data: { role },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/team/[id] — remove a member from the workspace
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Only OWNER / ADMIN can remove members
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Cannot remove yourself
  if (id === user.id) {
    return NextResponse.json({ error: "CANNOT_REMOVE_SELF" }, { status: 400 });
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
    return NextResponse.json({ error: "CANNOT_REMOVE_OWNER" }, { status: 400 });
  }

  // ADMIN cannot remove another ADMIN
  if (user.role === "ADMIN" && targetUser.role === "ADMIN") {
    return NextResponse.json({ error: "CANNOT_REMOVE_ADMIN" }, { status: 403 });
  }

  // Remove from workspace (set workspaceId to null, role to OWNER for future use)
  await prisma.user.update({
    where: { id },
    data: { workspaceId: null, role: "OWNER" },
  });

  return NextResponse.json({ success: true });
}
