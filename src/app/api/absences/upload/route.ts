import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import type { SessionUser } from "@/lib/types";
import { log } from "@/lib/logger";

/** Max file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for absence documents */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/absences/upload
 *
 * Upload a document for an absence request (e.g. Krankschreibung / AU).
 * Accepts multipart/form-data with a single "file" field.
 * Returns { url } on success.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type. Allowed: PDF, JPEG, PNG, WebP, HEIC.",
        },
        { status: 400 },
      );
    }

    // Generate a unique path: absences/<workspaceId>/<timestamp>-<filename>
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `absences/${user.workspaceId}/${Date.now()}-${sanitizedName}`;

    const blob = await put(path, file, {
      access: "public",
      addRandomSuffix: true,
    });

    log.info("[absences/upload] Document uploaded", {
      url: blob.url,
      workspaceId: user.workspaceId,
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    log.error("Error uploading absence document:", { error });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
