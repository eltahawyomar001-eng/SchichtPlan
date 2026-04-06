/**
 * Resolve the base URL for email links.
 * Always trim whitespace and strip trailing slashes to prevent malformed URLs.
 */
function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "https://www.shiftfy.de")
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Build a fully-qualified absolute URL from a link that may be relative or absolute.
 */
function resolveLink(link: string): string {
  const trimmed = link.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const base = getBaseUrl();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

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
    ABSENCE_REQUESTED: {
      de: "Antrag ansehen",
      en: "View request",
    },
    ABSENCE_APPROVED: {
      de: "Details ansehen",
      en: "View details",
    },
    ABSENCE_REJECTED: {
      de: "Details ansehen",
      en: "View details",
    },
    SHIFT_ASSIGNED: {
      de: "Schichtplan öffnen",
      en: "Open shift plan",
    },
    SHIFT_UPDATED: {
      de: "Schichtplan öffnen",
      en: "Open shift plan",
    },
    SHIFT_SWAP_REQUESTED: {
      de: "Tauschanfrage ansehen",
      en: "View swap request",
    },
    SHIFT_SWAP_APPROVED: {
      de: "Details ansehen",
      en: "View details",
    },
    SHIFT_SWAP_REJECTED: {
      de: "Details ansehen",
      en: "View details",
    },
    TIME_ENTRY_STATUS: {
      de: "Zeiterfassung öffnen",
      en: "Open time tracking",
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
  const lines = [`— ${title} —`, "", message];
  if (link) {
    const fullUrl = resolveLink(link);
    lines.push(
      "",
      locale === "de" ? `Hier klicken: ${fullUrl}` : `Click here: ${fullUrl}`,
    );
  }
  lines.push(
    "",
    "---",
    locale === "de"
      ? "Sie erhalten diese E-Mail, weil Sie Benachrichtigungen in Shiftfy aktiviert haben."
      : "You are receiving this email because you have notifications enabled in Shiftfy.",
    "",
    `© ${new Date().getFullYear()} Shiftfy`,
  );
  return lines.join("\n");
}

/**
 * Build production-ready branded HTML email for a notification.
 *
 * Design principles:
 * - Table-based layout for maximum email client compatibility
 * - All styles inline (no <style> blocks — stripped by Gmail, Outlook)
 * - No CSS gradients, box-shadow, or border-radius on outer elements (Outlook)
 * - Bulletproof CTA button using padding + background-color on <a> tag
 * - Explicit width constraints for mobile + desktop
 * - Fallback link text below button for clients that strip links
 * - Tested for: Gmail, Outlook (web + desktop), Apple Mail, Yahoo, dark mode
 */
export function buildEmailHtml(params: {
  type: string;
  title: string;
  message: string;
  link?: string | null;
  locale?: string;
}) {
  const { type, title, message, link, locale = "de" } = params;

  const ctaLabel = getCtaLabel(type, locale);
  const footerText =
    locale === "de"
      ? "Sie erhalten diese E-Mail, weil Sie Benachrichtigungen in Shiftfy aktiviert haben."
      : "You are receiving this email because you have notifications enabled in Shiftfy.";

  const ctaHref = link ? resolveLink(link) : null;

  // Preheader: short summary shown in inbox preview (hidden in body)
  const preheader =
    message.length > 120 ? message.slice(0, 117) + "..." : message;

  // ── Bulletproof CTA button ──
  // Uses padding on <a> tag itself (not on <td>) so the entire button area is clickable.
  // This approach works across Gmail, Outlook, Apple Mail, Yahoo without VML hacks.
  const ctaBlock = ctaHref
    ? `<!-- CTA Button -->
          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${ctaHref}" target="_blank" rel="noopener"
                       style="display:inline-block;background-color:#059669;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;text-align:center;text-decoration:none;padding:14px 32px;mso-padding-alt:0;border-radius:8px;">
                      <!--[if mso]><i style="letter-spacing:32px;mso-font-width:-100%;mso-text-raise:21pt;">&nbsp;</i><![endif]-->
                      <span style="mso-text-raise:10pt;">${ctaLabel}</span>
                      <!--[if mso]><i style="letter-spacing:32px;mso-font-width:-100%;">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Fallback link for clients that strip buttons -->
          <tr>
            <td align="center" style="padding:12px 40px 0;">
              <p style="margin:0;font-size:12px;line-height:1.4;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">
                ${locale === "de" ? "Link funktioniert nicht?" : "Link not working?"}
                <a href="${ctaHref}" target="_blank" rel="noopener" style="color:#059669;text-decoration:underline;">${locale === "de" ? "Hier klicken" : "Click here"}</a>
              </p>
            </td>
          </tr>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:#f3f4f6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Hidden preheader text -->
  <div style="display:none;font-size:1px;color:#f3f4f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
  </div>

  <!-- Outer wrapper: full-width background -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Inner card: 600px max -->
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;">

          <!-- ═══ Header Bar ═══ -->
          <tr>
            <td style="background-color:#047857;padding:24px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                      Shiftfy
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══ Accent line ═══ -->
          <tr>
            <td style="background-color:#059669;height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

          <!-- ═══ Title ═══ -->
          <tr>
            <td style="padding:32px 40px 12px;">
              <h2 style="margin:0;font-size:20px;font-weight:700;color:#111827;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                ${title}
              </h2>
            </td>
          </tr>

          <!-- ═══ Message body ═══ -->
          <tr>
            <td style="padding:0 40px 8px;">
              <p style="margin:0;font-size:16px;line-height:1.65;color:#374151;font-family:Arial,Helvetica,sans-serif;">
                ${message}
              </p>
            </td>
          </tr>

          ${ctaBlock}

          <!-- ═══ Spacer before footer ═══ -->
          <tr>
            <td style="padding:16px 0 0;font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

          <!-- ═══ Footer ═══ -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">
                ${footerText}
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.4;color:#d1d5db;font-family:Arial,Helvetica,sans-serif;">
                &copy; ${new Date().getFullYear()} Shiftfy &mdash; Schichtplanung &amp; Workforce Management
              </p>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;
}
