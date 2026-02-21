/**
 * Build branded HTML email for a notification.
 *
 * The template is intentionally simple + inline-styled for
 * maximum email-client compatibility (Outlook, Gmail, Apple Mail).
 */
export function buildEmailHtml(params: {
  type: string;
  title: string;
  message: string;
  link?: string | null;
  locale?: string;
}) {
  const { title, message, link, locale = "de" } = params;

  const ctaLabel =
    locale === "de" ? "Im Dashboard ansehen" : "View in dashboard";
  const footerText =
    locale === "de"
      ? "Sie erhalten diese E-Mail, weil Sie Benachrichtigungen in SchichtPlan aktiviert haben."
      : "You are receiving this email because you have notifications enabled in SchichtPlan.";

  // If link is already an absolute URL, use it directly; otherwise prepend base URL
  const ctaHref = link
    ? link.startsWith("http")
      ? link
      : `${process.env.NEXTAUTH_URL || "https://app.schichtplan.de"}${link}`
    : null;

  const ctaBlock = ctaHref
    ? `<tr>
         <td style="padding:24px 32px 0;">
           <a href="${ctaHref}"
              style="display:inline-block;padding:12px 24px;background:#6d28d9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              ${ctaLabel}
           </a>
         </td>
       </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#ffffff;">
              <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">SchichtPlan</h1>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <h2 style="margin:0;font-size:18px;color:#111827;font-weight:600;">${title}</h2>
            </td>
          </tr>
          <!-- Message -->
          <tr>
            <td style="padding:8px 32px 16px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${message}</p>
            </td>
          </tr>
          <!-- CTA Button -->
          ${ctaBlock}
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;margin-top:16px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                ${footerText}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
