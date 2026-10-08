/**
 * What an employee is told when their absence request is decided.
 *
 * The decision alone is not enough. Somebody with two requests in flight, or
 * who asked three weeks ago, cannot act on "Ihre Abwesenheit wurde genehmigt"
 * without opening the app to find out WHICH one -- and the whole point of the
 * push is that they do not have to.
 *
 * So the period is in the message, and the kind of request is named rather
 * than generalised to "Abwesenheit": people book flights against a Urlaub, and
 * the word they used when asking is the word they should get back.
 */

export type AbsenceCategory =
  | "URLAUB"
  | "KRANK"
  | "ELTERNZEIT"
  | "SONDERURLAUB"
  | "UNBEZAHLT"
  | "FORTBILDUNG"
  | "SONSTIGES";

/**
 * The noun for each category, in the accusative-free nominative the sentence
 * needs. Anything without a natural German compound falls back to the generic
 * term rather than inventing one.
 */
const REQUEST_NOUN: Record<AbsenceCategory, string> = {
  URLAUB: "Urlaubsantrag",
  SONDERURLAUB: "Sonderurlaubsantrag",
  ELTERNZEIT: "Antrag auf Elternzeit",
  FORTBILDUNG: "Antrag auf Fortbildung",
  UNBEZAHLT: "Antrag auf unbezahlten Urlaub",
  KRANK: "Abwesenheitsantrag",
  SONSTIGES: "Abwesenheitsantrag",
};

/** dd.MM.yyyy, which is how a German date is written on anything official. */
export function deDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export interface AbsenceDecisionMessage {
  title: string;
  body: string;
}

/**
 * The push text for an approved or rejected request.
 *
 * A one-day absence reads "für den 05.10.2026" rather than "vom 05.10.2026 bis
 * zum 05.10.2026", which is how a person would say it and avoids a sentence
 * that looks like a bug.
 */
export function absenceDecisionMessage(input: {
  category: AbsenceCategory;
  startDate: Date;
  endDate: Date;
  approved: boolean;
}): AbsenceDecisionMessage {
  const noun = REQUEST_NOUN[input.category] ?? "Abwesenheitsantrag";
  const verdict = input.approved ? "genehmigt" : "abgelehnt";

  const sameDay =
    input.startDate.getFullYear() === input.endDate.getFullYear() &&
    input.startDate.getMonth() === input.endDate.getMonth() &&
    input.startDate.getDate() === input.endDate.getDate();

  const period = sameDay
    ? `für den ${deDate(input.startDate)}`
    : `für den Zeitraum vom ${deDate(input.startDate)} bis zum ${deDate(input.endDate)}`;

  return {
    // The title alone already says which request and what happened, because a
    // lock-screen banner often shows little else.
    title: `${noun} ${verdict}`,
    body: `Ihr ${noun} ${period} wurde ${verdict}.`,
  };
}
