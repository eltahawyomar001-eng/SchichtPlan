import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  tryAutoApproveAbsence,
  createSystemNotification,
} from "@/lib/automations";

// ─── GET  /api/absences ─────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (year) {
      where.startDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    const absences = await prisma.absenceRequest.findMany({
      where,
      include: { employee: true },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(absences);
  } catch (error) {
    console.error("Error fetching absences:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── POST  /api/absences ────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const body = await req.json();

    // Validate required fields
    if (
      !body.employeeId ||
      !body.category ||
      !body.startDate ||
      !body.endDate
    ) {
      return NextResponse.json(
        {
          error: "Employee, category, start and end date are required",
        },
        { status: 400 },
      );
    }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    // Calculate total working days (simple: count weekdays)
    let totalDays = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) totalDays++;
      current.setDate(current.getDate() + 1);
    }
    if (body.halfDayStart) totalDays -= 0.5;
    if (body.halfDayEnd) totalDays -= 0.5;

    // Overlap check
    const overlapping = await prisma.absenceRequest.findFirst({
      where: {
        employeeId: body.employeeId,
        status: { in: ["AUSSTEHEND", "GENEHMIGT"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (overlapping) {
      return NextResponse.json(
        {
          error: "An absence request already exists for this period",
        },
        { status: 409 },
      );
    }

    const absence = await prisma.absenceRequest.create({
      data: {
        category: body.category,
        startDate: start,
        endDate: end,
        halfDayStart: body.halfDayStart || false,
        halfDayEnd: body.halfDayEnd || false,
        totalDays,
        reason: body.reason || null,
        employeeId: body.employeeId,
        workspaceId,
      },
      include: { employee: true },
    });

    // ── Automation: Try auto-approve (sick leave or no conflicts) ──
    const autoApproved = await tryAutoApproveAbsence(absence.id);

    // ── Automation: Notify managers about new request ──
    if (!autoApproved) {
      const empName = `${absence.employee.firstName} ${absence.employee.lastName}`;
      await createSystemNotification({
        type: "ABSENCE_REQUESTED",
        title: "Neuer Abwesenheitsantrag",
        message: `${empName} hat einen Abwesenheitsantrag (${body.category}) vom ${start.toLocaleDateString("de-DE")} bis ${end.toLocaleDateString("de-DE")} eingereicht.`,
        link: "/abwesenheiten",
        workspaceId,
        recipientType: "managers",
      });
    } else {
      // Notify employee that it was auto-approved
      if (absence.employee.email) {
        await createSystemNotification({
          type: "ABSENCE_AUTO_APPROVED",
          title: "Abwesenheit automatisch genehmigt",
          message: `Ihr Abwesenheitsantrag (${body.category}) wurde automatisch genehmigt.`,
          link: "/abwesenheiten",
          workspaceId,
          recipientType: "employee",
          employeeEmail: absence.employee.email,
        });
      }
    }

    // Re-fetch to get updated status if auto-approved
    const result = autoApproved
      ? await prisma.absenceRequest.findUnique({
          where: { id: absence.id },
          include: { employee: true },
        })
      : absence;

    return NextResponse.json({ ...result, autoApproved }, { status: 201 });
  } catch (error) {
    console.error("Error creating absence:", error);
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
