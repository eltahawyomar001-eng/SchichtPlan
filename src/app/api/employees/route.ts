import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireUserSlot } from "@/lib/subscription-guard";
import { createEmployeeSchema, validateBody } from "@/lib/validations";
import { executeCustomRules } from "@/lib/automations";
import { createAuditLogTx } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { checkIdempotency, cacheIdempotentResponse } from "@/lib/idempotency";
import { requireAuth, serverError } from "@/lib/api-response";
import { sendEmail } from "@/lib/notifications/email";
import { invitationEmail } from "@/lib/notifications/email-i18n";
import { getLocaleFromCookie } from "@/i18n/locale";
import { randomBytes } from "crypto";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";
import { reconcileSeatsFromEmployees } from "@/lib/billing-seats";

/** MiLoG minimum wage (€/h) — updated annually */
const MILOG_MIN_WAGE = 12.82;

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { workspaceId } = auth;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const { take, skip } = parsePagination(req);

    const where: Record<string, unknown> = { workspaceId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          employeeSkills: {
            include: { skill: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
          location: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          user: { select: { id: true, role: true } },
        },
        orderBy: { lastName: "asc" },
        take,
        skip,
      }),
      prisma.employee.count({ where }),
    ]);

    return paginatedResponse(employees, total, take, skip);
  } catch (error) {
    log.error("Error fetching employees:", { error: error });
    captureRouteError(error, { route: "/api/employees", method: "GET" });
    return serverError("Error loading");
  }
}

export async function POST(req: Request) {
  try {
    // ── Idempotency check (prevents duplicate employee creation) ──
    const cached = await checkIdempotency(req);
    if (cached) return cached;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER, ADMIN, MANAGER can create employees
    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    // Check plan limit (includes pending invitations in slot count)
    const planLimit = await requireUserSlot(workspaceId);
    if (planLimit) return planLimit;

    const body = await req.json();
    const parsed = validateBody(createEmployeeSchema, body);
    if (!parsed.success) return parsed.response;
    const {
      firstName,
      lastName,
      email,
      phone,
      position,
      hourlyRate,
      weeklyHours,
      workDaysPerWeek,
      contractType,
      color,
      locationId,
      departmentId,
    } = parsed.data;

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          position: position || null,
          hourlyRate: hourlyRate ?? null,
          weeklyHours: weeklyHours ?? null,
          workDaysPerWeek: workDaysPerWeek ?? 5,
          contractType: contractType ?? "VOLLZEIT",
          color:
            color ||
            `#${Math.floor(Math.random() * 16777215)
              .toString(16)
              .padStart(6, "0")}`,
          locationId: locationId || null,
          departmentId: departmentId || null,
          workspaceId,
        },
      });

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "CREATE",
        entityType: "employee",
        entityId: created.id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId,
        changes: { firstName, lastName, email, position, hourlyRate },
      });

      return created;
    });

    // ── PIN generation (fire & forget) ──
    (async () => {
      try {
        const rawPin = await generateUniquePin(workspaceId);
        const pHash = hashPin(workspaceId, rawPin);
        await prisma.employee.update({
          where: { id: employee.id },
          data: { pinHash: pHash },
        });
        if (email) {
          const ws = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { name: true },
          });
          await sendPinEmail({
            to: email,
            firstName,
            rawPin,
            workspaceName: ws?.name ?? "",
          });
        }
      } catch (err) {
        log.error("[Employees] PIN generation failed", { error: err });
      }
    })();

    // ── Automation: Execute custom rules ──
    executeCustomRules("employee.created", workspaceId, {
      id: employee.id,
      firstName,
      lastName,
      email,
      position: position || "",
    });

    // ── Invitation email (fire & forget) ──
    // When an email is provided for the new employee and the address isn't
    // already a workspace member or pending invite, automatically send an
    // invitation so they can register and get linked to this employee record.
    if (email) {
      (async () => {
        try {
          const alreadyMember = await prisma.user.findFirst({
            where: { email, workspaceId },
            select: { id: true },
          });
          const pendingInvite = alreadyMember
            ? null
            : await prisma.invitation.findFirst({
                where: { email, workspaceId, status: "PENDING" },
                select: { id: true },
              });

          if (!alreadyMember && !pendingInvite) {
            const token = randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const workspace = await prisma.workspace.findUnique({
              where: { id: workspaceId },
              select: { name: true },
            });
            await prisma.invitation.create({
              data: {
                token,
                email,
                role: "EMPLOYEE",
                status: "PENDING",
                expiresAt,
                workspaceId,
                invitedById: user.id,
              },
            });
            const locale = await getLocaleFromCookie();
            const inviterName = user.name || user.email || "Ihr Arbeitgeber";
            const workspaceName = workspace?.name || "Shiftfy";
            const copy = invitationEmail(
              locale,
              inviterName,
              workspaceName,
              "EMPLOYEE",
            );
            await sendEmail({
              to: email,
              type: "invitation",
              title: copy.subject,
              message: copy.body,
              link: `/einladung/${token}`,
              locale,
            });
            log.info(
              `[Employees] Invitation sent to ${email} for workspace ${workspaceId}`,
            );
          }
        } catch (err) {
          log.error("[Employees] Failed to send invitation email", {
            error: err,
          });
        }
      })();
    }

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId, "employee.created", {
      id: employee.id,
      firstName,
      lastName,
      email,
      position: position || null,
    }).catch((err) =>
      log.error("[webhook] employee.created dispatch error", { error: err }),
    );

    // ── Pay-as-you-grow: bump Stripe seat quantity ──
    // Awaited so the customer is billed in lockstep with the create. Fails
    // silently for sim-mode / unbilled workspaces — never blocks employee
    // creation on a Stripe outage (the next create or admin reconcile will
    // catch up since the helper computes seats from the live DB count).
    await reconcileSeatsFromEmployees(workspaceId);

    const warnings: string[] = [];
    if (hourlyRate != null && hourlyRate < MILOG_MIN_WAGE) {
      warnings.push(
        `Stundenlohn (${hourlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €) liegt unter dem gesetzlichen Mindestlohn (${MILOG_MIN_WAGE.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h, MiLoG)`,
      );
    }

    const response = NextResponse.json(
      { ...employee, ...(warnings.length ? { warnings } : {}) },
      { status: 201 },
    );
    await cacheIdempotentResponse(req, response);
    return response;
  } catch (error) {
    log.error("Error creating employee:", { error: error });
    captureRouteError(error, { route: "/api/employees", method: "POST" });
    return serverError("Error creating resource");
  }
}
