/**
 * What must be true before an invoice may be issued.
 *
 * Issuing is irreversible: it burns a number from a gapless sequence and
 * freezes the document. So everything that would make the result unusable is
 * checked BEFORE that happens, and reported all at once — a customer fixing
 * their master data should see the whole list, not discover a second missing
 * field after fixing the first.
 *
 * Two different bodies of rules are in play and they do not overlap neatly:
 *
 *   § 14 Abs. 4 UStG lists what a German invoice must contain for the
 *   recipient to deduct input tax. An invoice missing one of those is valid as
 *   a document but costs the recipient money, which is how we lose a customer.
 *
 *   EN 16931 / XRechnung business rules decide whether the recipient's system
 *   accepts the file at all.
 *
 * Checked here are the ones we can see coming from our own data. The rest is
 * left to the KoSIT validator, which is authoritative and which scripts/
 * validate-einvoices.sh runs against the golden fixtures.
 */

import type { InvoiceLine } from "./totals";

/** A single thing standing in the way of issuing. */
export interface PreflightIssue {
  /** Stable identifier, for tests and for the UI to link to the right form. */
  code: string;
  /**
   * German, addressed to the person who has to fix it, and naming WHERE.
   *
   * This text is the entire explanation a customer gets at the moment they are
   * blocked, so "Pflichtfeld fehlt" is not good enough.
   */
  message: string;
  /** Which form the fix lives in, so the UI can deep-link instead of guess. */
  scope: "issuer" | "client" | "invoice";
  /** Legal or business-rule basis, for the audit trail and for support. */
  basis?: string;
}

export interface PreflightIssuer {
  legalName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  vatId?: string | null;
  taxNumber?: string | null;
  kleinunternehmer?: boolean;
  email?: string | null;
  contactName?: string | null;
  legalRegistrationId?: string | null;
  iban?: string | null;
}

export interface PreflightClient {
  name?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  invoiceEmail?: string | null;
  email?: string | null;
  /** BT-48. Needed to substantiate a § 13b reverse charge. */
  vatId?: string | null;
  leitwegId?: string | null;
}

export interface PreflightInvoice {
  issueDate?: Date | null;
  lines: InvoiceLine[];
  reverseCharge?: boolean;
  /** A Storno must name what it reverses (BT-25). */
  typeCode?: "380" | "381";
  correctsNumber?: string | null;
}

const blank = (v: unknown): boolean =>
  v === null || v === undefined || String(v).trim() === "";

/**
 * Everything blocking this invoice, or an empty array.
 *
 * Deliberately returns ALL issues rather than throwing on the first: see the
 * note at the top of the file.
 */
export function preflightInvoice(input: {
  issuer: PreflightIssuer | null;
  client: PreflightClient | null;
  invoice: PreflightInvoice;
}): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const { issuer, client, invoice } = input;

  // ── The issuer (§ 14 Abs. 4 Nr. 1, 2) ──
  if (!issuer) {
    issues.push({
      code: "ISSUER_MISSING",
      message:
        "Es sind noch keine Rechnungsdaten Ihres Unternehmens hinterlegt. " +
        "Bitte legen Sie diese unter Einstellungen → Rechnungsstellung an.",
      scope: "issuer",
      basis: "§ 14 Abs. 4 Nr. 1 UStG",
    });
  } else {
    if (blank(issuer.legalName)) {
      issues.push({
        code: "ISSUER_NAME_MISSING",
        message:
          "Der vollständige Name Ihres Unternehmens fehlt (Einstellungen → Rechnungsstellung).",
        scope: "issuer",
        basis: "§ 14 Abs. 4 Nr. 1 UStG",
      });
    }
    if (
      blank(issuer.street) ||
      blank(issuer.postalCode) ||
      blank(issuer.city)
    ) {
      issues.push({
        code: "ISSUER_ADDRESS_INCOMPLETE",
        message:
          "Die vollständige Anschrift Ihres Unternehmens fehlt (Straße, PLZ und Ort).",
        scope: "issuer",
        basis: "§ 14 Abs. 4 Nr. 1 UStG",
      });
    }
    // Either identifier satisfies § 14 Abs. 4 Nr. 2 — but exactly one of them
    // is not optional, and an invoice without either is the single most common
    // reason a recipient's tax office refuses the input-tax deduction.
    if (blank(issuer.vatId) && blank(issuer.taxNumber)) {
      issues.push({
        code: "ISSUER_TAX_ID_MISSING",
        message:
          "Es fehlt Ihre Umsatzsteuer-Identifikationsnummer oder Steuernummer. " +
          "Eine von beiden muss auf jeder Rechnung stehen.",
        scope: "issuer",
        basis: "§ 14 Abs. 4 Nr. 2 UStG",
      });
    }
    // BR-CO-26 wants the seller identifiable by BT-29, BT-30 or BT-31. A
    // Steuernummer is none of those, so a Kleinunternehmer without a VAT ID
    // needs its Handelsregister entry — otherwise the file is rejected despite
    // being correct under German law.
    if (blank(issuer.vatId) && blank(issuer.legalRegistrationId)) {
      issues.push({
        code: "ISSUER_LEGAL_REGISTRATION_MISSING",
        message:
          "Ohne USt-IdNr. wird zusätzlich Ihre Handelsregisternummer benötigt, " +
          "damit die E-Rechnung von Empfängersystemen angenommen wird.",
        scope: "issuer",
        basis: "BR-CO-26 (EN 16931)",
      });
    }
    // BR-DE-2, a national rule absent from international examples.
    if (blank(issuer.contactName)) {
      issues.push({
        code: "ISSUER_CONTACT_MISSING",
        message:
          "Für deutsche E-Rechnungen ist ein Ansprechpartner verpflichtend.",
        scope: "issuer",
        basis: "BR-DE-2 (XRechnung)",
      });
    }
    if (blank(issuer.email)) {
      issues.push({
        code: "ISSUER_EMAIL_MISSING",
        message: "Eine E-Mail-Adresse Ihres Unternehmens ist verpflichtend.",
        scope: "issuer",
        basis: "PEPPOL-EN16931-R020",
      });
    }
    if (blank(issuer.iban)) {
      issues.push({
        code: "ISSUER_IBAN_MISSING",
        message:
          "Ohne IBAN enthält die Rechnung keine Zahlungsangaben. " +
          "Bitte hinterlegen Sie Ihre Bankverbindung.",
        scope: "issuer",
        basis: "BT-84 (EN 16931)",
      });
    }
  }

  // ── The recipient (§ 14 Abs. 4 Nr. 1) ──
  if (!client) {
    issues.push({
      code: "CLIENT_MISSING",
      message:
        "Die Rechnung ist keinem Kunden zugeordnet. Eine E-Rechnung benötigt " +
        "einen vollständigen Empfänger.",
      scope: "invoice",
      basis: "§ 14 Abs. 4 Nr. 1 UStG",
    });
  } else {
    if (blank(client.name)) {
      issues.push({
        code: "CLIENT_NAME_MISSING",
        message: "Der Name des Kunden fehlt.",
        scope: "client",
        basis: "§ 14 Abs. 4 Nr. 1 UStG",
      });
    }
    if (
      blank(client.street) ||
      blank(client.postalCode) ||
      blank(client.city)
    ) {
      issues.push({
        code: "CLIENT_ADDRESS_INCOMPLETE",
        message:
          "Die Anschrift des Kunden ist unvollständig (Straße, PLZ und Ort). " +
          "Eine E-Rechnung braucht die Adresse in strukturierten Feldern, " +
          "ein Adressblock als Freitext genügt nicht.",
        scope: "client",
        basis: "BG-8 (EN 16931)",
      });
    }
    if (blank(client.invoiceEmail) && blank(client.email)) {
      issues.push({
        code: "CLIENT_EMAIL_MISSING",
        message:
          "Für den Kunden ist keine E-Mail-Adresse hinterlegt; sie ist in der " +
          "E-Rechnung verpflichtend.",
        scope: "client",
        basis: "PEPPOL-EN16931-R010",
      });
    }
  }

  // ── The document itself ──
  if (invoice.lines.length === 0) {
    issues.push({
      code: "NO_LINES",
      message: "Die Rechnung enthält keine Positionen.",
      scope: "invoice",
      basis: "BR-16 (EN 16931)",
    });
  }
  // BR-27. Worth catching here rather than at the validator, because by then
  // the number would already be burnt.
  if (invoice.lines.some((l) => l.unitPriceCents < 0)) {
    issues.push({
      code: "NEGATIVE_UNIT_PRICE",
      message:
        "Ein negativer Einzelpreis ist nicht zulässig. Für eine Rückabwicklung " +
        "erstellen Sie eine Storno-Rechnung mit positiven Beträgen.",
      scope: "invoice",
      basis: "BR-27 (EN 16931)",
    });
  }
  if (invoice.lines.some((l) => blank(l.description))) {
    issues.push({
      code: "LINE_DESCRIPTION_MISSING",
      message: "Jede Rechnungsposition braucht eine Leistungsbeschreibung.",
      scope: "invoice",
      basis: "§ 14 Abs. 4 Nr. 5 UStG",
    });
  }
  if (!invoice.issueDate) {
    issues.push({
      code: "ISSUE_DATE_MISSING",
      message: "Das Rechnungsdatum fehlt.",
      scope: "invoice",
      basis: "§ 14 Abs. 4 Nr. 3 UStG",
    });
  }
  // A Storno that does not say what it reverses is unusable for the recipient
  // and fails BR-DE-19.
  if (invoice.typeCode === "381" && blank(invoice.correctsNumber)) {
    issues.push({
      code: "CORRECTION_REFERENCE_MISSING",
      message:
        "Eine Storno-Rechnung muss die Nummer der ursprünglichen Rechnung nennen.",
      scope: "invoice",
      basis: "BT-25 (EN 16931)",
    });
  }
  // Reverse charge without a VAT ID on either side cannot be substantiated:
  // § 13b shifts the liability to the recipient, who must be identifiable as a
  // taxable person for that to hold.
  if (invoice.reverseCharge && client && blank(client.vatId)) {
    issues.push({
      code: "REVERSE_CHARGE_WITHOUT_CLIENT_VAT_ID",
      message:
        "Für die Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) " +
        "wird die USt-IdNr. des Kunden benötigt.",
      scope: "client",
      basis: "§ 13b UStG",
    });
  }

  return issues;
}
