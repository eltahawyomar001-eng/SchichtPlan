/**
 * Centralised i18n strings for transactional emails.
 *
 * Every email the system sends MUST pull copy from here so that
 * locale switching is consistent (DE / EN).
 *
 * Convention: each entry is keyed by a logical email id and returns
 * subject + body as pure strings (no HTML — the template layer handles that).
 */

// ─── Role labels ────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { de: string; en: string }> = {
  OWNER: { de: "Inhaber", en: "Owner" },
  ADMIN: { de: "Administrator", en: "Admin" },
  MANAGER: { de: "Manager", en: "Manager" },
  EMPLOYEE: { de: "Mitarbeiter", en: "Employee" },
};

export function localiseRole(role: string, locale: string): string {
  const entry = ROLE_LABELS[role];
  if (entry) return locale === "de" ? entry.de : entry.en;
  return role.charAt(0) + role.slice(1).toLowerCase();
}

// ─── Invitation ─────────────────────────────────────────────────

export function invitationEmail(
  locale: string,
  inviterName: string,
  workspaceName: string,
  role: string,
) {
  const roleName = localiseRole(role, locale);

  if (locale === "de") {
    return {
      subject: `Einladung: Treten Sie „${workspaceName}" auf Shiftfy bei`,
      body:
        `${inviterName} hat Sie eingeladen, „${workspaceName}" als ${roleName} beizutreten. ` +
        `Klicken Sie auf die Schaltfläche unten, um die Einladung anzunehmen. ` +
        `Diese Einladung ist 7 Tage gültig.`,
    };
  }
  return {
    subject: `Invitation: Join "${workspaceName}" on Shiftfy`,
    body:
      `${inviterName} has invited you to join "${workspaceName}" as ${roleName}. ` +
      `Click the button below to accept the invitation. ` +
      `This invitation expires in 7 days.`,
  };
}

export function invitationReminderEmail(
  locale: string,
  inviterName: string,
  workspaceName: string,
  role: string,
) {
  const roleName = localiseRole(role, locale);

  if (locale === "de") {
    return {
      subject: `Erinnerung: Einladung zu „${workspaceName}" auf Shiftfy`,
      body:
        `${inviterName} erinnert Sie an Ihre Einladung, „${workspaceName}" als ${roleName} beizutreten. ` +
        `Klicken Sie auf die Schaltfläche unten, um die Einladung anzunehmen. ` +
        `Diese Einladung ist 7 Tage gültig.`,
    };
  }
  return {
    subject: `Reminder: Invitation to join "${workspaceName}" on Shiftfy`,
    body:
      `${inviterName} has reminded you about your invitation to join "${workspaceName}" as ${roleName}. ` +
      `Click the button below to accept. ` +
      `This invitation expires in 7 days.`,
  };
}

// ─── Password reset ─────────────────────────────────────────────

export function passwordResetEmail(locale: string) {
  if (locale === "de") {
    return {
      subject: "Passwort zurücksetzen — Shiftfy",
      body:
        "Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. " +
        "Klicken Sie auf den folgenden Link, um ein neues Passwort zu vergeben. " +
        "Dieser Link ist 1 Stunde gültig. " +
        "Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.",
    };
  }
  return {
    subject: "Reset your password — Shiftfy",
    body:
      "You requested a password reset. " +
      "Click the link below to set a new password. " +
      "This link is valid for 1 hour. " +
      "If you didn't request this, you can safely ignore this email.",
  };
}

// ─── Billing / payment failure ──────────────────────────────────

export function paymentFailedEmail(locale: string, workspaceName: string) {
  if (locale === "de") {
    return {
      subject: "Zahlung fehlgeschlagen – Aktion erforderlich",
      body:
        `Ihre letzte Zahlung für „${workspaceName}" konnte nicht verarbeitet werden. ` +
        `Bitte aktualisieren Sie Ihre Zahlungsmethode in den Einstellungen, ` +
        `um eine Unterbrechung Ihres Abonnements zu vermeiden.`,
    };
  }
  return {
    subject: "Payment failed – action required",
    body:
      `Your last payment for "${workspaceName}" could not be processed. ` +
      `Please update your payment method in settings to avoid ` +
      `any interruption to your subscription.`,
  };
}
