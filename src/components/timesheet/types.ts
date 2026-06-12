/** Client-side types for the timesheet OCR import flow. */

/** Below this AI confidence a field is flagged and MUST be verified. */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export interface StagedEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  shiftStart: string;
  /** HH:mm */
  shiftEnd: string;
  breakMinutes: number;
  confidence: number;
  confidenceScores: Record<string, number>;
}

export interface OcrResponse {
  importId: string;
  status: string;
  source: string;
  missingEmployees: string[];
  entries: StagedEntry[];
}

/** Map a field name from confidenceScores to the editable entry field. */
export const CONFIDENCE_FIELD_MAP: Record<string, keyof StagedEntry> = {
  date: "date",
  shiftStart: "shiftStart",
  shiftEnd: "shiftEnd",
  employeeName: "employeeName",
};

export function isLowConfidence(score: number | undefined): boolean {
  return typeof score === "number" && score < LOW_CONFIDENCE_THRESHOLD;
}
