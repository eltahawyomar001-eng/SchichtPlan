import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { visitSignatureSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";
import crypto from "crypto";

// ─── POST  /api/service-visits/[id]/signature ──────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-visits", "update");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(visitSignatureSchema, body);
    if (!parsed.success) return parsed.response;

    const {
      signatureData,
      signerName,
      signerRole,
      lat,
      lng,
      deviceId,
      clientTimestamp,
      gpsAccuracy,
    } = parsed.data;

    const visit = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
      include: { signature: true },
    });

    if (!visit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only add signature to their own visits
    if (isEmployee(user) && user.employeeId !== visit.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (visit.status !== "EINGECHECKT") {
      return NextResponse.json(
        { error: "Besuch muss eingecheckt sein für eine Unterschrift" },
        { status: 400 },
      );
    }

    if (visit.signature) {
      return NextResponse.json(
        { error: "Unterschrift wurde bereits erfasst" },
        { status: 409 },
      );
    }

    // Create tamper-proof hash: SHA-256 of visitId + signerName + lat + lng + timestamp
    const signedAt = new Date();
    const hashInput = [
      id,
      signerName,
      lat ?? "",
      lng ?? "",
      signedAt.toISOString(),
    ].join("|");
    const signatureHash = crypto
      .createHash("sha256")
      .update(hashInput)
      .digest("hex");

    // Create signature and update visit status if checked out
    const [signature] = await prisma.$transaction([
      prisma.visitSignature.create({
        data: {
          signatureData,
          signatureHash,
          signerName,
          signerRole: signerRole || null,
          signedAt,
          signedLat: lat ?? null,
          signedLng: lng ?? null,
          visitId: id,
        },
      }),
      // If already checked out, mark as ABGESCHLOSSEN
      ...(visit.checkOutAt
        ? [
            prisma.serviceVisit.update({
              where: { id },
              data: { status: "ABGESCHLOSSEN" },
            }),
          ]
        : []),
    ]);

    createAuditLog({
      action: "CREATE",
      entityType: "visit-signature",
      entityId: signature.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { visitId: id, signerName, signatureHash },
    });

    // Revisionssicher audit trail entry — includes signature data for legal proof
    createVisitAuditEntry(req, {
      eventType: "SIGNATURE_CAPTURED",
      visitId: id,
      userId: user.id,
      workspaceId,
      gpsLat: lat ?? null,
      gpsLng: lng ?? null,
      gpsAccuracy: gpsAccuracy ?? null,
      deviceId: deviceId ?? null,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
      signatureData, // base64 PNG stored in audit trail for Revisionssicherheit
      metadata: {
        signerName,
        signerRole: signerRole ?? null,
        signatureHash,
        signatureId: signature.id,
        employeeId: visit.employeeId,
      },
    });

    log.info("[service-visits] Signature captured", {
      visitId: id,
      signatureId: signature.id,
      signerName,
    });

    return NextResponse.json(signature, { status: 201 });
  } catch (error) {
    log.error("Error capturing signature:", { error });
    return NextResponse.json(
      { error: "Error capturing signature" },
      { status: 500 },
    );
  }
}
