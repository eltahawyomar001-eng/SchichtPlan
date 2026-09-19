import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import {
  ALLOWED_PHOTO_MIME,
  MAX_PHOTO_BYTES,
  createPhotoUploadUrl,
} from "@/lib/work-proof-storage";

/**
 * POST /api/work-proof/sign
 *
 * Mint a one-shot upload URL so the device sends its bytes straight to
 * storage. Nothing is recorded here: a signed URL is only permission to write
 * an object, and an upload that is never confirmed leaves an orphan, not a
 * false proof. The record is created by POST /api/work-proof once the bytes
 * are actually in place.
 */
const bodySchema = z.object({
  fileType: z.string().min(1).max(150),
  fileSize: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

export const POST = withRoute("/api/work-proof/sign", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const parsed = bodySchema.safeParse(_json.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { fileType } = parsed.data;
  if (!ALLOWED_PHOTO_MIME.includes(fileType)) {
    return NextResponse.json(
      {
        error: "UNSUPPORTED_TYPE",
        message: "Nur Fotos (JPEG, PNG, HEIC, WebP) sind erlaubt.",
      },
      { status: 415 },
    );
  }

  // Proof is attributed to a person, so the caller must BE an employee — an
  // admin account with no employee record has nobody to attribute it to.
  const employee = await prisma.employee.findFirst({
    where: { workspaceId, userId: user.id, isActive: true },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json(
      {
        error: "NO_EMPLOYEE_RECORD",
        message: "Für dieses Konto ist kein aktiver Mitarbeiter hinterlegt.",
      },
      { status: 403 },
    );
  }

  const upload = await createPhotoUploadUrl(workspaceId, employee.id, fileType);
  return NextResponse.json(upload, { status: 201 });
});
