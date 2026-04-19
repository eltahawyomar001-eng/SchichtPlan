/**
 * Zeiterfassung – time calculation & validation utilities
 *
 * All durations are stored in minutes internally.
 * "Industrial minutes" = decimal hours  (7 h 30 min → 7.50)
 */

// ─── Parsing ────────────────────────────────────────────────────

/** Parse "HH:mm" → total minutes since midnight */
export function parseHHmm(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Format total minutes → "HH:mm" */
export function formatMinutesToHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Duration calculations ──────────────────────────────────────

/** Gross minutes between two HH:mm strings (handles overnight) */
export function calcGrossMinutes(start: string, end: string): number {
  const s = parseHHmm(start);
  let e = parseHHmm(end);
  if (e <= s) e += 24 * 60; // overnight shift
  return e - s;
}

/** Break duration from breakStart / breakEnd or explicit breakMinutes */
export function calcBreakMinutes(
  breakStart?: string | null,
  breakEnd?: string | null,
  explicitMinutes?: number,
): number {
  if (breakStart && breakEnd) {
    return calcGrossMinutes(breakStart, breakEnd);
  }
  return explicitMinutes ?? 0;
}

/** Net = gross – break */
export function calcNetMinutes(
  grossMinutes: number,
  breakMinutes: number,
): number {
  return Math.max(0, grossMinutes - breakMinutes);
}

// ─── Industrial minutes (decimal hours) ─────────────────────────

/** Convert minutes → decimal hours  (450 → 7.50) */
export function toIndustrialHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Derive a stable, numeric-only Personalnummer from an opaque CUID.
 *
 * DATEV and German payroll systems expect an all-digit personnel number.
 * We hash every character of the ID into a 6-digit number (100 000 – 999 999)
 * using a simple DJB2-style hash. The result is deterministic — the same
 * employee ID always produces the same Personalnummer.
 */
export function toPersonnelNumber(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0; // hash * 33 + c
  }
  // Map to 100000–999999 range (6-digit, no leading zero)
  const num = 100_000 + (Math.abs(hash) % 900_000);
  return String(num);
}

/** Format decimal hours with 2 decimals, German locale (7.5 → "7,50") */
export function formatIndustrial(
  minutes: number,
  locale: string = "de",
): string {
  return toIndustrialHours(minutes).toLocaleString(
    locale === "en" ? "en-GB" : "de-DE",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
}

// ─── Calendar week (ISO 8601) ───────────────────────────────────

/** Get ISO calendar week number for a date */
export function getCalendarWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ─── Validation ─────────────────────────────────────────────────

export interface TimeEntryInput {
  date: string; // ISO date string
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  breakMinutes?: number;
  employeeId: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Validate a time entry and return an array of errors (empty = valid) */
export function validateTimeEntry(input: TimeEntryInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!input.date)
    errors.push({ field: "date", message: "Datum ist erforderlich" });
  if (!input.startTime)
    errors.push({ field: "startTime", message: "Startzeit ist erforderlich" });
  if (!input.endTime)
    errors.push({ field: "endTime", message: "Endzeit ist erforderlich" });
  if (!input.employeeId)
    errors.push({
      field: "employeeId",
      message: "Mitarbeiter ist erforderlich",
    });

  // HH:mm format
  const timeRe = /^\d{2}:\d{2}$/;
  if (input.startTime && !timeRe.test(input.startTime))
    errors.push({ field: "startTime", message: "Format muss HH:mm sein" });
  if (input.endTime && !timeRe.test(input.endTime))
    errors.push({ field: "endTime", message: "Format muss HH:mm sein" });

  // Gross > 0
  if (
    input.startTime &&
    input.endTime &&
    timeRe.test(input.startTime) &&
    timeRe.test(input.endTime)
  ) {
    const gross = calcGrossMinutes(input.startTime, input.endTime);
    if (gross <= 0)
      errors.push({
        field: "endTime",
        message: "Endzeit muss nach Startzeit liegen",
      });
    if (gross > 24 * 60)
      errors.push({
        field: "endTime",
        message: "Schicht darf max. 24 h dauern",
      });

    // Break plausibility
    const breakMins = calcBreakMinutes(
      input.breakStart,
      input.breakEnd,
      input.breakMinutes,
    );
    if (breakMins < 0)
      errors.push({
        field: "breakMinutes",
        message: "Pause darf nicht negativ sein",
      });
    if (breakMins >= gross)
      errors.push({
        field: "breakMinutes",
        message: "Pause darf nicht länger als die Schicht sein",
      });

    // Legal break requirement (Germany: >6h → 30 min, >9h → 45 min)
    if (gross > 9 * 60 && breakMins < 45)
      errors.push({
        field: "breakMinutes",
        message: "Bei >9 h Arbeitszeit: mind. 45 Min. Pause (ArbZG)",
      });
    else if (gross > 6 * 60 && breakMins < 30)
      errors.push({
        field: "breakMinutes",
        message: "Bei >6 h Arbeitszeit: mind. 30 Min. Pause (ArbZG)",
      });
  }

  // Break start/end must both be present or both absent
  if (
    (input.breakStart && !input.breakEnd) ||
    (!input.breakStart && input.breakEnd)
  ) {
    errors.push({
      field: "breakStart",
      message: "Pausenstart und -ende müssen beide angegeben werden",
    });
  }

  return errors;
}

// ─── Status labels ──────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  ENTWURF: "Entwurf",
  EINGEREICHT: "Eingereicht",
  KORREKTUR: "Korrektur nötig",
  ZURUECKGEWIESEN: "Zurückgewiesen",
  GEPRUEFT: "Geprüft",
  BESTAETIGT: "Bestätigt",
};

export const STATUS_LABELS_EN: Record<string, string> = {
  ENTWURF: "Draft",
  EINGEREICHT: "Submitted",
  KORREKTUR: "Correction needed",
  ZURUECKGEWIESEN: "Rejected",
  GEPRUEFT: "Reviewed",
  BESTAETIGT: "Confirmed",
};

/** Get the localised status label for a given DB enum value. */
export function getStatusLabel(status: string, locale: string): string {
  const labels = locale === "en" ? STATUS_LABELS_EN : STATUS_LABELS;
  return labels[status] ?? status;
}

// ─── CSV export column headers (locale-aware) ───────────────────

export const CSV_HEADERS_DE = {
  employee: "Mitarbeiter",
  location: "Standort",
  calendarWeek: "KW",
  date: "Datum",
  start: "Beginn",
  end: "Ende",
  pauseMin: "Pause (HH:mm)",
  grossHHmm: "Brutto (Std.)",
  netHHmm: "Netto (Std.)",
  industrialHours: "Industriezeit (h)",
  status: "Status",
  confirmedBy: "Freigabe durch",
  confirmedAt: "Freigabe am",
  total: "GESAMT",
  // DATEV-specific
  personnelNo: "Personalnummer",
  lastName: "Nachname",
  firstName: "Vorname",
  pauseMinOnly: "Pause (Min)",
  grossStd: "Brutto (Std)",
  netStd: "Netto (Std)",
  closed: "Abgeschlossen",
  // download/report export
  email: "E-Mail",
  phone: "Telefon",
  position: "Position",
  hourlyRate: "Stundenlohn",
  weeklyHours: "Wochenstunden",
  netMin: "Netto (Min)",
  remarks: "Bemerkung",
  notes: "Notizen",
  sheetEmployees: "Mitarbeiter",
  sheetTimeEntries: "Zeiteinträge",
  sheetShiftPlan: "Schichtplan",
  // Arbeitszeitnachweis PDF
  workTimeRecord: "Arbeitszeitnachweis",
  employer: "Arbeitgeber",
  employeeSingle: "Mitarbeiter",
  period: "Zeitraum",
  personnelNumber: "Personalnummer",
  break_: "Pause",
  workingTime: "Arbeitszeit",
  totalHours: "Gesamtstunden",
  targetHoursApprox: "Soll-Stunden (ca.)",
  createdOn: "Erstellt am",
  signatureEmployer: "Unterschrift Arbeitgeber",
  signatureEmployee: "Unterschrift Arbeitnehmer",
};

export const CSV_HEADERS_EN: typeof CSV_HEADERS_DE = {
  employee: "Employee",
  location: "Location",
  calendarWeek: "CW",
  date: "Date",
  start: "Start",
  end: "End",
  pauseMin: "Break (HH:mm)",
  grossHHmm: "Gross (hrs)",
  netHHmm: "Net (hrs)",
  industrialHours: "Industrial hours (h)",
  status: "Status",
  confirmedBy: "Confirmed by",
  confirmedAt: "Confirmed at",
  total: "TOTAL",
  // DATEV-specific
  personnelNo: "Personnel No.",
  lastName: "Last name",
  firstName: "First name",
  pauseMinOnly: "Break (min)",
  grossStd: "Gross (hrs)",
  netStd: "Net (hrs)",
  closed: "Closed",
  // download/report export
  email: "Email",
  phone: "Phone",
  position: "Position",
  hourlyRate: "Hourly rate",
  weeklyHours: "Weekly hours",
  netMin: "Net (min)",
  remarks: "Remarks",
  notes: "Notes",
  sheetEmployees: "Employees",
  sheetTimeEntries: "Time entries",
  sheetShiftPlan: "Shift plan",
  // Arbeitszeitnachweis PDF
  workTimeRecord: "Work Time Record",
  employer: "Employer",
  employeeSingle: "Employee",
  period: "Period",
  personnelNumber: "Personnel No.",
  break_: "Break",
  workingTime: "Working time",
  totalHours: "Total hours",
  targetHoursApprox: "Target hours (approx.)",
  createdOn: "Created on",
  signatureEmployer: "Employer signature",
  signatureEmployee: "Employee signature",
};

/** Get locale-aware CSV/export headers. */
export function getExportHeaders(locale: string): typeof CSV_HEADERS_DE {
  return locale === "en" ? CSV_HEADERS_EN : CSV_HEADERS_DE;
}

export const STATUS_COLORS: Record<string, string> = {
  ENTWURF: "bg-gray-100 text-gray-700",
  EINGEREICHT: "bg-emerald-100 text-emerald-700",
  KORREKTUR: "bg-yellow-100 text-yellow-700",
  ZURUECKGEWIESEN: "bg-red-100 text-red-700",
  GEPRUEFT: "bg-emerald-100 text-emerald-700",
  BESTAETIGT: "bg-green-100 text-green-700",
};
