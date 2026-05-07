import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { billingAuditEmail } from "@/lib/notifications/email-i18n";
import { log } from "@/lib/logger";

export type AuditEmailStatus =
  | "sent"
  | "quota_exceeded"
  | "no_email"
  | "no_stripe"
  | "error";

export interface AuditEmailResult {
  status: AuditEmailStatus;
  invoiceCount?: number;
}

/**
 * Fetches the current-month paid Stripe invoices for a workspace and sends
 * a billing-confirmation email to the given billingEmail address.
 *
 * Enforces the workspace monthly email quota (emailsSentThisMonth vs
 * emailsMonthlyLimit). Increments the counter on successful send.
 *
 * Returns a structured result so the caller can surface appropriate UI feedback.
 */
export async function sendMonthlyBillingEmail(
  workspaceId: string,
  billingEmail: string,
): Promise<AuditEmailResult> {
  if (!billingEmail) return { status: "no_email" };

  // ── 1. Quota check ────────────────────────────────────────────
  const usage = await prisma.workspaceUsage.findUnique({
    where: { workspaceId },
    select: { emailsSentThisMonth: true, emailsMonthlyLimit: true },
  });

  if (
    usage &&
    usage.emailsMonthlyLimit !== -1 &&
    usage.emailsSentThisMonth >= usage.emailsMonthlyLimit
  ) {
    return { status: "quota_exceeded" };
  }

  // ── 2. Load workspace + owner locale + Stripe customer ────────
  const [workspace, subscription, owner] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    prisma.subscription.findUnique({
      where: { workspaceId },
      select: { stripeCustomerId: true },
    }),
    prisma.user.findFirst({
      where: { workspaceId, role: "OWNER" },
      select: { preferredLocale: true },
    }),
  ]);

  const locale = owner?.preferredLocale === "en" ? "en" : "de";

  if (!subscription?.stripeCustomerId) {
    return { status: "no_stripe" };
  }

  // ── 3. Fetch current-month paid invoices from Stripe ──────────
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stripe = getStripe();
  let invoices: Array<{
    number: string | null;
    amount: string;
    hostedUrl: string | null;
  }> = [];

  try {
    const result = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      created: { gte: Math.floor(firstOfMonth.getTime() / 1000) },
      limit: 20,
    });

    const numberFmt = new Intl.NumberFormat(
      locale === "en" ? "en-GB" : "de-DE",
      { style: "currency", currency: "EUR" },
    );

    invoices = result.data
      .filter((inv) => inv.status === "paid")
      .map((inv) => ({
        number: typeof inv.number === "string" ? inv.number : null,
        amount: numberFmt.format((inv.amount_paid ?? 0) / 100),
        hostedUrl:
          typeof inv.hosted_invoice_url === "string"
            ? inv.hosted_invoice_url
            : null,
      }));
  } catch (err) {
    log.error("[billing-audit-email] Stripe invoice fetch failed", { err });
  }

  // ── 4. Build and send email ───────────────────────────────────
  const monthLabel = now.toLocaleDateString(
    locale === "en" ? "en-GB" : "de-DE",
    { month: "long", year: "numeric" },
  );

  const copy = billingAuditEmail(
    locale,
    workspace?.name ?? workspaceId,
    monthLabel,
    invoices,
  );

  const result = await sendEmail({
    to: billingEmail,
    type: "SYSTEM",
    title: copy.subject,
    message: copy.body,
    link: "/einstellungen/abonnement",
    locale,
  });

  if (!result.success) {
    log.error("[billing-audit-email] Send failed", { error: result.error });
    return { status: "error" };
  }

  // ── 5. Increment quota counter ────────────────────────────────
  await prisma.workspaceUsage.updateMany({
    where: { workspaceId },
    data: { emailsSentThisMonth: { increment: 1 } },
  });

  log.info("[billing-audit-email] Sent", {
    workspaceId,
    to: billingEmail,
    invoiceCount: invoices.length,
  });

  return { status: "sent", invoiceCount: invoices.length };
}
