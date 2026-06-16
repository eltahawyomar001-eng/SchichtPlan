import { NextResponse } from "next/server";
import { prisma, withWorkspaceContext } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { requireUserSlot } from "@/lib/subscription-guard";
import { createEmployeeSchema, validateBody } from "@/lib/validations";
import { executeCustomRules } from "@/lib/automations";
import { createAuditLogTx } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { sendEmail } from "@/lib/notifications/email";
import { invitationEmail } from "@/lib/notifications/email-i18n";
import { getLocaleFromCookie } from "@/i18n/locale";
import { randomBytes } from "crypto";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";
import { reconcileSeatsFromEmployees } from "@/lib/billing-seats";

/** MiLoG statutory minimum wage (€/h), 2026 value — updated annually. */
const MILOG_MIN_WAGE = 13.9;

export const GET = withRoute("/api/employees", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId, user } = auth;

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

  // DSGVO Art. 5(1)(c) data minimisation: wage and contract fields must not
  // be fetched from the DB at all for EMPLOYEE-role requests, not just stripped
  // in JS after the query. pinHash is never returned to any client.
  // withWorkspaceContext: switches to shiftfy_app role (NOBYPASSRLS) so RLS
  // policies enforce workspace isolation as a second layer after app-level auth.
  const [employees, total] = await withWorkspaceContext(
    workspaceId,
    async (tx) =>
      Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tx.employee.findMany as any)({
          where,
          // pinHash is fetched so we can derive a `hasPin` boolean below, then
          // stripped before the response — the hash itself never reaches a client.
          omit: isEmployee(user)
            ? { hourlyRate: true, contractType: true }
            : undefined,
          include: {
            employeeSkills: {
              include: { skill: { select: { id: true, name: true } } },
              orderBy: { createdAt: "asc" },
            },
            location: { select: { id: true, name: true } },
            departments: {
              include: { department: { select: { id: true, name: true } } },
              orderBy: { assignedAt: "asc" },
            },
            user: { select: { id: true, role: true } },
          },
          orderBy: { lastName: "asc" },
          take,
          skip,
        }),
        tx.employee.count({ where }),
      ]),
  );

  // Derive a client-safe `hasPin` flag and strip the hash from the payload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitized = (employees as any[]).map((e) => {
    const { pinHash, ...rest } = e;
    return { ...rest, hasPin: !!pinHash };
  });

  return paginatedResponse(sanitized, total, take, skip);
});

export const POST = withRoute(
  "/api/employees",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER, ADMIN, MANAGER can create employees
    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    // Check plan limit (includes pending invitations in slot count)
    const planLimit = await requireUserSlot(workspaceId);
    if (planLimit) return planLimit;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data;
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
      departmentIds,
      datevPersonnelNumber,
      employmentStartDate,
      dateOfBirth,
      socialSecurityNumber,
      birthPlace,
      nationality,
    } = parsed.data;

    // MiLoG (Mindestlohngesetz) hard block — applies to all contract types.
    // Reject before touching the DB so no partial state is created.
    if (hourlyRate != null && hourlyRate < MILOG_MIN_WAGE) {
      return NextResponse.json(
        {
          error: "MILOG_VIOLATION",
          message: `Der angegebene Stundenlohn (${hourlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h) unterschreitet den gesetzlichen Mindestlohn von ${MILOG_MIN_WAGE.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h (MiLoG). Bitte korrigieren Sie den Stundenlohn.`,
          messageEn: `The specified hourly rate (${hourlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h) is below the statutory minimum wage of ${MILOG_MIN_WAGE.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h (MiLoG). Please correct the hourly rate.`,
          milogMinWage: MILOG_MIN_WAGE,
        },
        { status: 422 },
      );
    }

    // Generate PIN before the transaction so the hash is included in the
    // employee.create call. The @@unique([workspaceId, pinHash]) constraint
    // makes the write atomic — no TOCTOU window between check and insert.
    const rawPin = await generateUniquePin(workspaceId);
    const pinHash = hashPin(workspaceId, rawPin);

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
          datevPersonnelNumber: datevPersonnelNumber?.trim() || null,
          employmentStartDate: employmentStartDate
            ? new Date(employmentStartDate)
            : null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          socialSecurityNumber: socialSecurityNumber?.trim() || null,
          birthPlace: birthPlace?.trim() || null,
          nationality: nationality?.trim() || null,
          workspaceId,
          pinHash,
        },
      });

      // ── Department assignments (many-to-many) ──
      if (departmentIds && departmentIds.length > 0) {
        await tx.employeeDepartment.createMany({
          data: departmentIds.map((departmentId) => ({
            employeeId: created.id,
            departmentId,
          })),
          skipDuplicates: true,
        });
      }

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

    // ── PIN email — awaited, failure flagged for cron retry ──
    if (email) {
      try {
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
      } catch (err) {
        log.error("[Employees] PIN email failed — flagging for cron retry", {
          error: err,
          employeeId: employee.id,
        });
        await prisma.employee
          .update({
            where: { id: employee.id },
            data: { pinEmailFailed: true },
          })
          .catch((e) =>
            log.error("[Employees] Failed to set pinEmailFailed", { error: e }),
          );
      }
    }

    // ── Automation: Execute custom rules ──
    executeCustomRules("employee.created", workspaceId, {
      id: employee.id,
      firstName,
      lastName,
      email,
      position: position || "",
    });

    // ── Invitation email (awaited, outcome reported) ──
    // When an email is provided for the new employee and the address isn't
    // already a workspace member or pending invite, automatically send an
    // invitation so they can register and get linked to this employee record.
    // Awaited (not fire-and-forget) so the UI can confirm the email actually
    // went out — silent failure here was the cause of "no email fired".
    let invitationSent = false;
    let invitationSkipped: "ALREADY_MEMBER" | "ALREADY_INVITED" | null = null;
    let invitationFailed = false;
    if (email) {
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

        if (alreadyMember) {
          invitationSkipped = "ALREADY_MEMBER";
        } else if (pendingInvite) {
          invitationSkipped = "ALREADY_INVITED";
        } else {
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
            category: "transactional",
            title: copy.subject,
            message: copy.body,
            link: `/einladung/${token}`,
            locale,
          });
          invitationSent = true;
          log.info(
            `[Employees] Invitation sent to ${email} for workspace ${workspaceId}`,
          );
        }
      } catch (err) {
        invitationFailed = true;
        log.error("[Employees] Failed to send invitation email", {
          error: err,
        });
      }
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
    // Employee is already committed. If Stripe is down we log the drift and
    // return a seatSyncPending flag so the caller can surface a retry prompt.
    // The next successful reconcile (triggered by any subsequent create/delete
    // or admin action) will catch up automatically.
    let seatSyncPending = false;
    const seatResult = await reconcileSeatsFromEmployees(workspaceId, "add");
    if (!seatResult.ok) {
      seatSyncPending = true;
      log.error(
        "[billing-seats] POST seat sync failed — employee created but Stripe not updated",
        {
          employeeId: employee.id,
          workspaceId,
          reason: seatResult.reason,
        },
      );
      captureRouteError(new Error(`Seat sync drift: ${seatResult.reason}`), {
        route: "/api/employees",
        method: "POST",
      });
    }

    const response = NextResponse.json(
      {
        ...employee,
        ...(seatSyncPending ? { seatSyncPending: true } : {}),
        invitationSent,
        invitationSkipped,
        invitationFailed,
      },
      { status: 201 },
    );
    return response;
  },
  { idempotent: true },
);
