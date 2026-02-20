import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

// ── GET /api/profile/export — Data export (Art. 20 DSGVO Datenübertragbarkeit) ──
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as SessionUser;
    const userId = sessionUser.id;
    const workspaceId = sessionUser.workspaceId;

    // 1. User account data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        consentGivenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Linked employee record(s) in user's workspace
    const employees = await prisma.employee.findMany({
      where: {
        email: user.email,
        workspaceId: workspaceId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        position: true,
        hourlyRate: true,
        weeklyHours: true,
        isActive: true,
        createdAt: true,
      },
    });

    const employeeIds = employees.map((e) => e.id);

    // 3. Shifts
    const shifts = employeeIds.length
      ? await prisma.shift.findMany({
          where: { employeeId: { in: employeeIds } },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            notes: true,
            status: true,
            createdAt: true,
            location: { select: { name: true, address: true } },
          },
          orderBy: { date: "desc" },
        })
      : [];

    // 4. Time entries
    const timeEntries = employeeIds.length
      ? await prisma.timeEntry.findMany({
          where: { employeeId: { in: employeeIds } },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
            grossMinutes: true,
            netMinutes: true,
            remarks: true,
            status: true,
            createdAt: true,
            location: { select: { name: true } },
          },
          orderBy: { date: "desc" },
        })
      : [];

    // 5. Absence requests
    const absences = employeeIds.length
      ? await prisma.absenceRequest.findMany({
          where: { employeeId: { in: employeeIds } },
          select: {
            id: true,
            category: true,
            startDate: true,
            endDate: true,
            totalDays: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { startDate: "desc" },
        })
      : [];

    // 6. Availability
    const availabilities = employeeIds.length
      ? await prisma.availability.findMany({
          where: { employeeId: { in: employeeIds } },
          select: {
            id: true,
            weekday: true,
            startTime: true,
            endTime: true,
            type: true,
            validFrom: true,
            validUntil: true,
            notes: true,
          },
          orderBy: { weekday: "asc" },
        })
      : [];

    // 7. Time account
    const timeAccounts = employeeIds.length
      ? await prisma.timeAccount.findMany({
          where: { employeeId: { in: employeeIds } },
          select: {
            contractHours: true,
            carryoverMinutes: true,
            currentBalance: true,
            periodStart: true,
            periodEnd: true,
          },
        })
      : [];

    // 8. Notification preferences
    const notificationPreferences =
      await prisma.notificationPreference.findMany({
        where: { userId },
        select: {
          channel: true,
          enabled: true,
        },
      });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportFormat: "DSGVO Art. 20 Datenübertragbarkeit",
      user,
      employees,
      shifts,
      timeEntries,
      absences,
      availabilities,
      timeAccounts,
      notificationPreferences,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="schichtplan-datenexport-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Error exporting data" },
      { status: 500 },
    );
  }
}
