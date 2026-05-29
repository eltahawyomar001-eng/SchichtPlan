import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import {
  uploadWorkspaceLogo,
  deleteWorkspaceLogo,
  MAX_LOGO_BYTES,
  ALLOWED_LOGO_TYPES,
} from "@/lib/workspace-logo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("logo");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Kein Bild übermittelt" },
      { status: 400 },
    );
  }

  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "Bild zu groß (max. 2 MB)" },
      { status: 400 },
    );
  }

  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Nur PNG, JPEG, WebP und SVG erlaubt" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadWorkspaceLogo(workspaceId, file.type, buffer);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { logo: url },
  });

  return NextResponse.json({ logo: url });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { logo: true },
  });

  if (workspace?.logo) {
    await deleteWorkspaceLogo(workspace.logo);
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { logo: null },
  });

  return NextResponse.json({ success: true });
}
