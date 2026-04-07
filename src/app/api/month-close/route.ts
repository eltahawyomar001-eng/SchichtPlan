import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { canUseFeature } from "@/lib/subscription";
import { createESignature, getClientIp } from "@/lib/e-signature";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { monthCloseSchema, validateBody } from "@/lib/validations";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { withRetry } from "@/lib/prisma-retry";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/** GET /api/month-close — list month-close records for workspace */
export const GET = withRoute("/api/month-close", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "month-close", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const { take, skip } = parsePagination(req);

  const where: Record<string, unknown> = {
    workspaceId,
  };
  if (year) where.year = parseInt(year, 10);

  const [records, total] = await Promise.all([
    prisma.monthClose.findMany({
      where,
      include: { exportJobs: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take,
      skip,
    }),
    prisma.monthClose.count({ where }),
  ]);

  return paginatedResponse(records, total, take, skip);
});

/**
 * POST /api/month-close — lock or export a month.
 * Body: { year, month, action: "lock" | "unlock" | "export" }
 */
export const POST = withRoute(
  "/api/month-close",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "month-close", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(monthCloseSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { year, month, action } = parsed.data;

    // Upsert the month-close record
    const existing = await prisma.monthClose.findFirst({
      where: {
        workspaceId,
        year,
        month,
      },
    });

    if (action === "lock") {
      const record = await withRetry(
        () =>
          prisma.$transaction(async (tx) => {
            // Check inside transaction to prevent race conditions
            const found = await tx.monthClose.findFirst({
              where: {
                workspaceId,
                year,
                month,
              },
            });

            return found
              ? await tx.monthClose.update({
                  where: { id: found.id },
                  data: {
                    status: "LOCKED",
                    lockedBy: user.id,
                    lockedAt: new Date(),
                  },
                })
              : await tx.monthClose.create({
                  data: {
                    year,
                    month,
                    status: "LOCKED",
                    lockedBy: user.id,
                    lockedAt: new Date(),
                    workspaceId,
                  },
                });
          }),
        "/api/month-close POST (lock)",
      );

      // ── E-Signature: Record signed month lock (Professional+ only) ──
      const hasESign = await canUseFeature(workspaceId, "eSignatures");
      if (hasESign) {
        createESignature({
          action: "month-close.lock",
          entityType: "MonthClose",
          entityId: record.id,
          signer: {
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            role: user.role,
          },
          workspaceId,
          ipAddress: getClientIp(req),
          userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => log.error("E-signature failed", { error: err }));
      }

      createAuditLog({
        action: "CREATE",
        entityType: "MonthClose",
        entityId: record.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { year, month, action: "lock" },
      });

      dispatchWebhook(workspaceId, "month_close.locked", {
        id: record.id,
        year,
        month,
      }).catch(() => {});

      return NextResponse.json(record);
    }

    if (action === "unlock") {
      if (!existing) {
        return NextResponse.json({ error: "Month not found" }, { status: 404 });
      }

      const record = await prisma.monthClose.update({
        where: { id: existing.id },
        data: { status: "OPEN", lockedBy: null, lockedAt: null },
      });

      createAuditLog({
        action: "UPDATE",
        entityType: "MonthClose",
        entityId: record.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { year, month, action: "unlock" },
      });

      dispatchWebhook(workspaceId, "month_close.unlocked", {
        id: record.id,
        year,
        month,
      }).catch(() => {});

      return NextResponse.json(record);
    }

    if (action === "export") {
      if (!existing || existing.status === "OPEN") {
        return NextResponse.json(
          { error: "Month must be locked before export" },
          { status: 400 },
        );
      }

      const record = await prisma.monthClose.update({
        where: { id: existing.id },
        data: { status: "EXPORTED", exportedAt: new Date() },
      });

      createAuditLog({
        action: "UPDATE",
        entityType: "MonthClose",
        entityId: record.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { year, month, action: "export" },
      });

      dispatchWebhook(workspaceId, "month_close.exported", {
        id: record.id,
        year,
        month,
      }).catch(() => {});

      return NextResponse.json(record);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  },
  { idempotent: true },
);
