/** Client-side types for the timesheet OCR import flow. */

/** Below this AI confidence a field is flagged and MUST be verified. */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export type MatchKind = "matched" | "suggested" | "unmatched";

export interface WorkspaceEmployeeOption {
  id: string;
  name: string;
}

export interface StagedEntry {
  id: string;
  /** Confidently matched employee, or null when the manager must assign one. */
  employeeId: string | null;
  employeeName: string | null;
  /** Raw name read off the sheet — shown so the manager can assign correctly. */
  extractedName: string | null;
  /** Best fuzzy guess to pre-select in the picker (manager confirms). */
  suggestedEmployeeId: string | null;
  suggestedEmployeeName: string | null;
  matchKind: MatchKind;
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
  /** Options for the per-row employee picker. */
  workspaceEmployees: WorkspaceEmployeeOption[];
  entries: StagedEntry[];
}

export function isLowConfidence(score: number | undefined): boolean {
  return typeof score === "number" && score < LOW_CONFIDENCE_THRESHOLD;
}
