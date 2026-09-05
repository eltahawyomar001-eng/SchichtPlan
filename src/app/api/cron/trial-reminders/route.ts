import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { sendEmail } from "@/lib/notifications/email";

/**
 * GET /api/cron/trial-reminders
 *
 * Warns workspace owners before their trial lapses.
 *
 * Until this existed, a trial simply went silent: `expire-trials` flipped the
 * subscription to CANCELED at 05:00 and the owner discovered it by being
 * locked out. All four companies that reached Stripe Checkout in Jul-Aug 2026
 * abandoned it and were never contacted again. This is the follow-up that was
 * missing.
 *
 * Runs daily, after expire-trials, and mails on the 7th, 3rd and last day
 * before `trialEnd`.
 *
 * Idempotency without a migration: each send writes a Notification row whose
 * `type` encodes the milestone (`trial_reminder_7`). The row is both the
 * in-app nudge and the "already sent" marker, so a re-run or an overlapping
 * invocation cannot double-mail.
 */

/** Days before trialEnd at which an owner is warned. */
const MILESTONES = [7, 3, 1] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Copy {
  subject: string;
  body: string;
}

/** German copy; the app is German-first and these go to German SMBs. */
function copyFor(days: number, workspaceName: string): Copy {
  if (days === 1) {
    return {
      subject: "Ihre Shiftfy-Testphase endet morgen",
      body:
        `Ihre Testphase für „${workspaceName}" endet morgen. ` +
        `Danach ist der Zugang zu Dienstplänen, Zeiterfassung und Auswertungen gesperrt. ` +
        `Ihre Daten bleiben erhalten und sind sofort wieder verfügbar, sobald Sie ein Abo abschließen. ` +
        `Die Einrichtung dauert etwa zwei Minuten.`,
    };
  }
  if (days === 3) {
    return {
      subject: "Noch 3 Tage Shiftfy-Testphase",
      body:
        `Ihre Testphase für „${workspaceName}" läuft in 3 Tagen ab. ` +
        `Wenn Sie weiterarbeiten möchten, wählen Sie jetzt einen Tarif aus. ` +
        `Bereits erfasste Zeiten und Dienstpläne bleiben vollständig erhalten.`,
    };
  }
  return {
    subject: "Noch eine Woche Shiftfy-Testphase",
    body:
      `Ihre Testphase für „${workspaceName}" läuft in einer Woche ab. ` +
      `Falls Fragen offen sind oder Sie eine Funktion vermissen, antworten Sie einfach auf diese E-Mail. ` +
      `Andernfalls können Sie hier direkt einen Tarif auswählen.`,
  };
}

export const GET = withRoute(
  "/api/cron/trial-reminders",
  "GET",
  async (req) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 401 },
      );
    }

    const now = new Date();
    const sent: { workspaceId: string; days: number }[] = [];
    const failed: { workspaceId: string; error: string }[] = [];

    for (const days of MILESTONES) {
      // Everything whose trial ends inside this 24h bucket. Bucketing by day
      // rather than matching an exact timestamp means a missed or delayed run
      // still catches the workspace on the next invocation.
      const windowStart = new Date(now.getTime() + (days - 1) * DAY_MS);
      const windowEnd = new Date(now.getTime() + days * DAY_MS);

      const due = await prisma.subscription.findMany({
        where: {
          status: "TRIALING",
          // A workspace that already converted has a real Stripe subscription
          // and will be charged automatically — warning them would be wrong.
          stripeSubscriptionId: null,
          trialEnd: { gte: windowStart, lt: windowEnd },
        },
        select: {
          workspaceId: true,
          trialEnd: true,
          workspace: { select: { name: true } },
        },
      });

      for (const sub of due) {
        const type = `trial_reminder_${days}`;

        const already = await prisma.notification.findFirst({
          where: { workspaceId: sub.workspaceId, type },
          select: { id: true },
        });
        if (already) continue;

        // Only owners and admins can subscribe, so only they are worth mailing.
        const recipients = await prisma.user.findMany({
          where: {
            workspaceId: sub.workspaceId,
            role: { in: ["OWNER", "ADMIN"] },
          },
          select: { id: true, email: true, preferredLocale: true },
        });
        // User.email is nullable in the schema, so filter in code rather than
        // in the where clause (Prisma types it as non-nullable there).
        const mailable = recipients.filter(
          (r): r is typeof r & { email: string } => !!r.email,
        );
        if (mailable.length === 0) continue;

        const { subject, body } = copyFor(days, sub.workspace?.name ?? "");
        const link = "/einstellungen/abonnement";

        try {
          for (const r of mailable) {
            await sendEmail({
              to: r.email,
              type,
              // Transactional, not marketing: it concerns the state of an
              // account the user already holds, so it needs no marketing
              // consent and must not be suppressed with promotional mail.
              category: "transactional",
              title: subject,
              message: body,
              link,
              locale: r.preferredLocale ?? "de",
            });
          }

          // Written only after the mails go out, so a send failure leaves the
          // milestone un-marked and the next run retries it.
          await prisma.notification.createMany({
            data: mailable.map((r) => ({
              type,
              title: subject,
              message: body,
              link,
              userId: r.id,
              workspaceId: sub.workspaceId,
            })),
          });

          sent.push({ workspaceId: sub.workspaceId, days });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error("[cron/trial-reminders] send failed", {
            workspaceId: sub.workspaceId,
            days,
            error: msg,
          });
          failed.push({ workspaceId: sub.workspaceId, error: msg });
        }
      }
    }

    if (sent.length > 0 || failed.length > 0) {
      log.info("[cron/trial-reminders] done", {
        sent: sent.length,
        failed: failed.length,
      });
    }

    return NextResponse.json({ sent: sent.length, failed: failed.length });
  },
);
