import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { isManagement } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { computeReadiness } from "@/lib/audit-readiness";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/seed-fks-demo
 *
 * Builds a complete, PDF-ready Zoll-Shield scenario and attaches it to the
 * calling user, so an FKS dossier can be exported immediately without hand-
 * entering a month of data.
 *
 * ── Why this is more than a session check ──
 * This product is single-workspace-per-user: identity lives on
 * `User.workspaceId`, with no membership join table. Moving the caller into
 * the demo workspace therefore DETACHES them from their real one. Behind a
 * bare session check, any logged-in employee at a customer could call this and
 * lose access to their employer's schedule, which is a production incident
 * rather than a demo.
 *
 * So, on top of the required authenticated session:
 *   - the caller must hold a management role (OWNER/ADMIN/MANAGER), which
 *     keeps the blast radius to people who already administer a workspace;
 *   - the previous workspaceId is returned as `previousWorkspaceId` and logged,
 *     so the move is reversible;
 *   - nothing in any existing workspace is read, modified or deleted — the
 *     scenario is built entirely from new rows.
 *
 * Restore afterwards with:
 *   UPDATE "User" SET "workspaceId" = '<previousWorkspaceId>' WHERE id = '<userId>';
 */
export const POST = withRoute("/api/admin/seed-fks-demo", "POST", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  if (!isManagement(user)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message:
          "Nur Inhaber, Administratoren oder Manager dürfen die Demo-Daten erzeugen.",
      },
      { status: 403 },
    );
  }

  const previousWorkspaceId = user.workspaceId ?? null;

  // Dates are relative so the scenario always lands inside the dossier's
  // default 30-day window, however long after seeding it is exported.
  const today = new Date();
  const dayAt = (daysAgo: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const atTime = (daysAgo: number, hh: number, mm: number) => {
    const d = dayAt(daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d;
  };
  const iso = (d: Date) => d.toLocaleDateString("en-CA");

  const suffix = randomBytes(4).toString("hex");

  const result = await prisma.$transaction(async (tx) => {
    /* ── Workspace ── */
    const workspace = await tx.workspace.create({
      data: {
        name: "FKS Demo Security GmbH",
        // Slug is globally unique, so repeated seeding must not collide.
        slug: `fks-demo-security-${suffix}`,
        industry: "Sicherheitsdienstleistungen",
        bundesland: "BE",
        betriebsnummer: "12345678",
        minHourlyWageCents: 1390,
        securitySectorMode: true,
        onboardingCompleted: true,
      },
    });

    // Without an active subscription the dashboard's plan gates would lock
    // the demo workspace the moment it is opened.
    await tx.subscription.create({
      data: {
        workspaceId: workspace.id,
        plan: "PROFESSIONAL",
        status: "ACTIVE",
        seatCount: 5,
        currentPeriodStart: dayAt(30),
        currentPeriodEnd: new Date(
          today.getFullYear() + 1,
          today.getMonth(),
          today.getDate(),
        ),
        schichtplanungAddonActive: true,
      },
    });

    /* ── Move the caller in (reversible; see header) ── */
    await tx.user.update({
      where: { id: user.id },
      data: { workspaceId: workspace.id, role: "OWNER" },
    });

    /* ── Guarded object, geofenced ── */
    const location = await tx.location.create({
      data: {
        workspaceId: workspace.id,
        name: "Objekt Alexanderplatz",
        address: "Alexanderplatz 1, 10178 Berlin",
        bundesland: "BE",
        latitude: 52.52,
        longitude: 13.405,
        geofenceRadiusMeters: 50,
        geofenceEnforced: true,
        geocodedAt: new Date(),
      },
    });

    // §34a is required at this object, so the readiness engine evaluates it
    // per shift rather than only via securitySectorMode.
    const skill = await tx.skill.create({
      data: {
        workspaceId: workspace.id,
        name: "§34a Sachkunde",
        category: "Sicherheit",
      },
    });
    await tx.locationRequiredSkill.create({
      data: { locationId: location.id, skillId: skill.id },
    });

    /* ── Employee A: fully compliant ── */
    const employeeA = await tx.employee.create({
      data: {
        workspaceId: workspace.id,
        firstName: "Lena",
        lastName: "Krüger",
        email: `lena.krueger.${suffix}@fks-demo.example`,
        position: "Sicherheitsmitarbeiterin",
        hourlyRate: 16.5,
        weeklyHours: 40,
        contractType: "VOLLZEIT",
        locationId: location.id,
        employmentStartDate: dayAt(400),
        bewacherId: "BWR-789012",
        bewacherRegisterStatus: "GEPRUEFT",
        bewacherValidatedAt: dayAt(120),
        reliabilityCheckedAt: dayAt(125),
        employeeSkills: {
          create: {
            skillId: skill.id,
            certificateNumber: "SK-2024-4471",
            issuingAuthority: "IHK Berlin",
            issuedAt: dayAt(400),
            // Valid well past the audit window.
            expiresAt: new Date(today.getFullYear() + 2, 0, 1),
          },
        },
      },
    });

    /* ── Employee B: non-compliant, the row an auditor flags ──
         No Bewacher-ID, no register status, no §34a certificate, and a wage
         below the MiLoG threshold. Every failure category lights up. */
    const employeeB = await tx.employee.create({
      data: {
        workspaceId: workspace.id,
        firstName: "Tobias",
        lastName: "Renner",
        email: `tobias.renner.${suffix}@fks-demo.example`,
        position: "Sicherheitsmitarbeiter",
        hourlyRate: 12.0,
        weeklyHours: 20,
        contractType: "TEILZEIT",
        locationId: location.id,
        employmentStartDate: dayAt(60),
        bewacherId: null,
        bewacherRegisterStatus: null,
      },
    });

    /* ── OCR provenance ── */
    const documentRef = createHash("sha256")
      .update(`fks-demo-stundenzettel-${suffix}`)
      .digest("hex");

    const timesheetImport = await tx.timesheetImport.create({
      data: {
        workspaceId: workspace.id,
        status: "APPROVED",
        source: "MOCK",
        documentRef,
        importedByUserId: user.id,
        importedAt: atTime(10, 9, 15),
        reviewedByUserId: user.id,
        reviewedAt: atTime(10, 10, 0),
      },
    });

    /* ── Shifts for Employee A, promoted from the OCR import ── */
    const shiftPlan = [
      { daysAgo: 9, start: "06:00", end: "14:30" },
      { daysAgo: 7, start: "06:00", end: "14:30" },
      { daysAgo: 5, start: "14:00", end: "22:30" },
      { daysAgo: 3, start: "22:00", end: "06:00" },
    ];

    const shifts = [];
    for (const p of shiftPlan) {
      const shift = await tx.shift.create({
        data: {
          workspaceId: workspace.id,
          employeeId: employeeA.id,
          locationId: location.id,
          date: dayAt(p.daysAgo),
          startTime: p.start,
          endTime: p.end,
          breakMinutes: 30,
          status: "COMPLETED",
          isNightShift: p.start === "22:00",
          notes: `Importiert aus Stundenzettel (${timesheetImport.id})`,
        },
      });
      shifts.push(shift);

      // The staging row that produced it — this is the link an auditor
      // follows from a shift back to the scanned original.
      await tx.timesheetImportEntry.create({
        data: {
          importId: timesheetImport.id,
          workspaceId: workspace.id,
          employeeId: employeeA.id,
          extractedName: "Krüger, Lena",
          date: dayAt(p.daysAgo),
          startTime: p.start,
          endTime: p.end,
          breakMinutes: 30,
          confidence: 0.97,
          confidenceScores: JSON.stringify({
            employeeName: 0.99,
            date: 0.98,
            shiftStart: 0.96,
            shiftEnd: 0.95,
          }),
          status: "APPROVED",
          materializedShiftId: shift.id,
        },
      });
    }

    // One uncertified shift for Employee B — the §34a violation.
    await tx.shift.create({
      data: {
        workspaceId: workspace.id,
        employeeId: employeeB.id,
        locationId: location.id,
        date: dayAt(4),
        startTime: "08:00",
        endTime: "16:30",
        breakMinutes: 30,
        status: "COMPLETED",
      },
    });

    /* ── Actual worked time, with geofence evidence ── */
    const geoPlan = [
      { daysAgo: 9, start: "06:02", end: "14:31", distance: 14.2 },
      { daysAgo: 7, start: "05:58", end: "14:28", distance: 9.6 },
      { daysAgo: 5, start: "14:03", end: "22:35", distance: 21.8 },
    ];

    for (const g of geoPlan) {
      await tx.timeEntry.create({
        data: {
          workspaceId: workspace.id,
          employeeId: employeeA.id,
          locationId: location.id,
          date: dayAt(g.daysAgo),
          startTime: g.start,
          endTime: g.end,
          breakMinutes: 30,
          grossMinutes: 509,
          netMinutes: 479,
          status: "BESTAETIGT",
          isLiveClock: true,
          clockInAt: atTime(g.daysAgo, 6, 2),
          clockOutAt: atTime(g.daysAgo, 14, 31),
          checkInLatitude: 52.5201,
          checkInLongitude: 13.4051,
          checkInAccuracyM: 8,
          checkInDistanceM: g.distance,
          geofenceStatus: "INSIDE",
          locationMocked: false,
        },
      });
    }

    // The overridden punch: outside the radius, released by a named manager.
    const overriddenEntry = await tx.timeEntry.create({
      data: {
        workspaceId: workspace.id,
        employeeId: employeeA.id,
        locationId: location.id,
        date: dayAt(3),
        startTime: "22:04",
        endTime: "06:02",
        breakMinutes: 30,
        grossMinutes: 478,
        netMinutes: 448,
        status: "BESTAETIGT",
        isLiveClock: true,
        clockInAt: atTime(3, 22, 4),
        clockOutAt: atTime(2, 6, 2),
        checkInLatitude: 52.5238,
        checkInLongitude: 13.4127,
        checkInAccuracyM: 12,
        checkInDistanceM: 612.4,
        geofenceStatus: "OVERRIDDEN",
        locationMocked: false,
        geofenceOverrideBy: user.id,
        geofenceOverrideReason:
          "Zufahrt wegen Bauarbeiten gesperrt, Anmeldung am Ersatzeingang.",
      },
    });

    /* ── Audited releases ── */
    await tx.complianceOverride.createMany({
      data: [
        {
          workspaceId: workspace.id,
          rule: "GEOFENCE",
          entityType: "TimeEntry",
          entityId: overriddenEntry.id,
          reason:
            "Zufahrt wegen Bauarbeiten gesperrt, Anmeldung am Ersatzeingang erfolgte telefonisch.",
          overriddenBy: user.id,
          overriddenAt: atTime(3, 22, 10),
        },
        {
          workspaceId: workspace.id,
          rule: "SACHKUNDE_34A",
          entityType: "Shift",
          entityId: shifts[0]?.id ?? overriddenEntry.id,
          reason:
            "Sachkundenachweis liegt in Papierform vor, Registereintrag ist beantragt.",
          overriddenBy: user.id,
          overriddenAt: atTime(4, 11, 30),
        },
      ],
    });

    return {
      workspaceId: workspace.id,
      locationId: location.id,
      employeeAId: employeeA.id,
      employeeBId: employeeB.id,
      timesheetImportId: timesheetImport.id,
    };
  });

  /* ── Freeze a dossier so the PDF is exportable immediately ──
       Outside the transaction: computeReadiness re-reads what was just
       committed, and holding the write transaction open across it would be
       needless contention. */
  const from = iso(dayAt(30));
  const to = iso(today);
  let dossierId: string | null = null;
  try {
    const readiness = await computeReadiness(result.workspaceId, from, to);
    const contentHash = createHash("sha256")
      .update(JSON.stringify(readiness))
      .digest("hex");
    const dossier = await prisma.auditDossier.create({
      data: {
        workspaceId: result.workspaceId,
        periodStart: new Date(from),
        periodEnd: new Date(to),
        readinessScore: readiness.score,
        passCount: readiness.totals.pass,
        warnCount: readiness.totals.warn,
        failCount: readiness.totals.fail,
        snapshot: readiness as object,
        contentHash,
        generatedById: user.id,
      },
    });
    dossierId = dossier.id;
  } catch (err) {
    // The scenario itself is already committed and usable; a dossier can be
    // generated from the Prüfungssicher page by hand.
    log.warn("[seed-fks-demo] dossier generation failed", {
      error: err instanceof Error ? err.message : String(err),
      workspaceId: result.workspaceId,
    });
  }

  createAuditLog({
    action: "CREATE",
    entityType: "Workspace",
    entityId: result.workspaceId,
    userId: user.id,
    userEmail: user.email,
    workspaceId: result.workspaceId,
    changes: { seed: "fks-demo", previousWorkspaceId },
  });

  log.warn("[seed-fks-demo] demo workspace created; user reassigned", {
    userId: user.id,
    workspaceId: result.workspaceId,
    previousWorkspaceId,
  });

  return NextResponse.json({
    ok: true,
    message:
      "FKS-Demo-Workspace erstellt. Sie wurden diesem Workspace als OWNER zugeordnet.",
    workspaceId: result.workspaceId,
    previousWorkspaceId,
    dossierId,
    pdfUrl: dossierId ? `/api/compliance/dossier/${dossierId}/pdf` : null,
    restoreHint: previousWorkspaceId
      ? `Zum Zurückwechseln: UPDATE "User" SET "workspaceId" = '${previousWorkspaceId}' WHERE id = '${user.id}';`
      : null,
    created: result,
  });
});
