/**
 * Context-aware CTA button label based on email type.
 */
function getCtaLabel(type: string, locale: string): string {
  const labels: Record<string, { de: string; en: string }> = {
    "email-verification": {
      de: "E-Mail-Adresse bestätigen",
      en: "Verify email address",
    },
    "password-reset": {
      de: "Passwort zurücksetzen",
      en: "Reset password",
    },
    invitation: {
      de: "Einladung annehmen",
      en: "Accept invitation",
    },
  };
  const entry = labels[type];
  if (entry) return locale === "de" ? entry.de : entry.en;
  return locale === "de" ? "Im Dashboard ansehen" : "View in dashboard";
}

/**
 * Build a plain-text fallback for email clients that don't render HTML.
 */
export function buildPlainText(params: {
  title: string;
  message: string;
  link?: string | null;
  locale?: string;
}): string {
  const { title, message, link, locale = "de" } = params;
  const lines = [title, "", message];
  if (link) {
    lines.push("", link);
  }
  lines.push(
    "",
    locale === "de"
      ? "Sie erhalten diese E-Mail, weil Sie Benachrichtigungen in Shiftfy aktiviert haben."
      : "You are receiving this email because you have notifications enabled in Shiftfy.",
  );
  return lines.join("\n");
}

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
  const { type, title, message, link, locale = "de" } = params;

  // Use context-aware CTA label
  const ctaLabel = getCtaLabel(type, locale);
  const footerText =
    locale === "de"
      ? "Sie erhalten diese E-Mail, weil Sie Benachrichtigungen in Shiftfy aktiviert haben."
      : "You are receiving this email because you have notifications enabled in Shiftfy.";

  // If link is already an absolute URL, use it directly; otherwise prepend base URL
  const ctaHref = link
    ? link.startsWith("http")
      ? link
      : `${process.env.NEXTAUTH_URL || "https://www.shiftfy.de"}${link}`
    : null;

  const ctaBlock = ctaHref
    ? `<tr>
         <td style="padding:24px 32px 0;" align="left">
           <!--[if mso]>
           <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaHref}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="18%" strokecolor="#047857" fillcolor="#047857">
             <w:anchorlock/>
             <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">${ctaLabel}</center>
           </v:roundrect>
           <![endif]-->
           <!--[if !mso]><!-->
           <table role="presentation" cellpadding="0" cellspacing="0" border="0">
             <tr>
               <td style="background:#047857;border-radius:8px;padding:12px 24px;" align="center">
                 <a href="${ctaHref}" target="_blank"
                    style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:inline-block;">
                    ${ctaLabel}
                 </a>
               </td>
             </tr>
           </table>
           <!--<![endif]-->
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
            <td style="padding:24px 32px;background:linear-gradient(135deg,#047857,#059669);color:#ffffff;">
              <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Shiftfy</h1>
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
