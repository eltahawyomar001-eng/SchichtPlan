import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import {
  ALLOWED_PHOTO_MIME,
  MAX_PHOTO_BYTES,
  uploadPhotoBytes,
} from "@/lib/work-proof-storage";

/**
 * POST /api/work-proof/upload — multipart fallback for the proof photo.
 *
 * The primary path has the device PUT straight to storage through a signed
 * URL, which keeps the bytes off this server entirely. This exists because
 * "primary path" and "path that works on every device" are not the same claim,
 * and a worker standing on a Baustelle cannot debug a failed upload.
 *
 * The trade-off is Vercel's ~4.5 MB request body cap. A camera photo at the
 * quality the app captures lands around 1–3 MB, so this is a viable fallback
 * but not a viable default — hence the ordering.
 *
 * Deliberately only stores the object. The proof RECORD is still created by
 * POST /api/work-proof, so the server-stamped time and geofence verdict are
 * computed in exactly one place for both paths.
 */
export const POST = withRoute("/api/work-proof/upload", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const employee = await prisma.employee.findFirst({
    where: { workspaceId, userId: user.id, isActive: true },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "NO_EMPLOYEE_RECORD" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const mime = file.type || "image/jpeg";
  if (!ALLOWED_PHOTO_MIME.includes(mime)) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.byteLength) {
    return NextResponse.json({ error: "EMPTY_FILE" }, { status: 400 });
  }

  const storagePath = await uploadPhotoBytes(
    workspaceId,
    employee.id,
    mime,
    bytes,
  );

  log.info("[work-proof] photo stored via multipart fallback", {
    workspaceId,
    bytes: bytes.byteLength,
  });

  // Same shape the signing endpoint returns, so the client can hand either to
  // POST /api/work-proof without caring which route the bytes took.
  return NextResponse.json({ path: storagePath }, { status: 201 });
});
