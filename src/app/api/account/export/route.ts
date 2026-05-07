import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/account/export
 *
 * GDPR Art. 20 — Right to Data Portability.
 * Returns a machine-readable JSON dump of the requesting user's personal data:
 *  - profile (name, email, phone, locale, role)
 *  - employee record (if linked)
 *  - time entries (full history)
 *  - notifications (last 1000)
 *  - notification preferences
 *
 * Excludes other workspace members' data (privacy of third parties).
 */
export const GET = withRoute("/api/account/export", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      preferredLocale: true,
      role: true,
      consentGivenAt: true,
      tosVersion: true,
      tosAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
      notificationPreferences: {
        select: { channel: true, enabled: true },
      },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          position: true,
          hourlyRate: true,
          weeklyHours: true,
          contractType: true,
          createdAt: true,
          timeEntries: {
            orderBy: { date: "desc" },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              breakMinutes: true,
              grossMinutes: true,
              netMinutes: true,
              clockInAt: true,
              clockOutAt: true,
              isLiveClock: true,
              status: true,
            },
          },
        },
      },
      notifications: {
        take: 1000,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          createdAt: true,
        },
      },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    gdprArticle: "Art. 20 — Right to Data Portability",
    data: dbUser,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="shiftfy-data-export-${dbUser.id}.json"`,
    },
  });
});
