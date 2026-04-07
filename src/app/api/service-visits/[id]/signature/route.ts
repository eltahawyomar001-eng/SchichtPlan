import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import {
  compressSignature,
  requireStorageQuota,
  recordStorageUsage,
} from "@/lib/subscription-guard";
import { visitSignatureSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { createSystemNotification } from "@/lib/automations";
import { log } from "@/lib/logger";
import crypto from "crypto";
import { withRoute } from "@/lib/with-route";

// ─── POST  /api/service-visits/[id]/signature ──────────────────
export const POST = withRoute(
  "/api/service-visits/[id]/signature",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-visits", "update");
    if (forbidden) return forbidden;

    // E-Signatures require Professional plan
    const planGate = await requirePlanFeature(workspaceId, "eSignatures");
    if (planGate) return planGate;

    const body = await req.json();
    const parsed = validateBody(visitSignatureSchema, body);
    if (!parsed.success) return parsed.response;

    const {
      signatureData: rawSignatureData,
      signerName,
      signerRole,
      deviceId,
      clientTimestamp,
    } = parsed.data;

    // Compress signature: PNG → WebP (quality 0.6) to minimize storage costs
    const compressed = await compressSignature(rawSignatureData);
    const signatureData = compressed.data;

    // Check storage quota before saving
    const storageLimit = await requireStorageQuota(
      workspaceId,
      compressed.bytes,
    );
    if (storageLimit) return storageLimit;

    const visit = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
      include: {
        signature: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
      },
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

    // Create tamper-proof hash: SHA-256 of visitId + signerName + timestamp
    const signedAt = new Date();
    const hashInput = [id, signerName, signedAt.toISOString()].join("|");
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

    // Record storage consumption
    await recordStorageUsage(workspaceId, compressed.bytes);

    createAuditLog({
      action: "CREATE",
      entityType: "visit-signature",
      entityId: signature.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { visitId: id, signerName, signatureHash },
    });

    dispatchWebhook(workspaceId, "service_visit.signature_captured", {
      visitId: id,
      signatureId: signature.id,
    }).catch(() => {});

    // Revisionssicher audit trail entry — includes signature data for legal proof
    createVisitAuditEntry(req, {
      eventType: "SIGNATURE_CAPTURED",
      visitId: id,
      userId: user.id,
      workspaceId,
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

    // ── Notify managers about the completed signature ──
    const empName = `${visit.employee.firstName} ${visit.employee.lastName}`;
    const locName = visit.location.name;
    createSystemNotification({
      type: "VISIT_SIGNED",
      title: "Leistungsnachweis unterschrieben",
      message: `Der Leistungsnachweis für ${empName} am Standort ${locName} wurde von ${signerName} unterschrieben.`,
      link: "/leistungsnachweis",
      workspaceId,
      recipientType: "managers",
    }).catch((err) =>
      log.error("[service-visits] Notification dispatch error", { error: err }),
    );

    return NextResponse.json(signature, { status: 201 });
  },
  { idempotent: true },
);
