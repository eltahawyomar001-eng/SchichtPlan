/** Shared types for the calendar components */

export interface CalendarEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  departmentId: string | null;
}

export interface CalendarShift {
  id: string;
  date: string; // ISO date
  startTime: string;
  endTime: string;
  status: string;
  isNightShift: boolean;
  employee: CalendarEmployee | null;
}

export interface CalendarAbsence {
  id: string;
  category: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  totalDays: number;
  employee: CalendarEmployee;
}

export interface CalendarHoliday {
  id: string;
  name: string;
  date: string; // ISO date
  bundesland: string;
  isNational: boolean;
}

export interface CalendarDepartment {
  id: string;
  name: string;
  color: string | null;
}

export interface CalendarProject {
  id: string;
  name: string;
}

export type EventType =
  | "shift"
  | "vacation"
  | "sick"
  | "parentalLeave"
  | "specialLeave"
  | "unpaidLeave"
  | "training"
  | "other"
  | "publicHoliday";

/** Map AbsenceCategory enum to our EventType */
export const CATEGORY_TO_EVENT_TYPE: Record<string, EventType> = {
  URLAUB: "vacation",
  KRANK: "sick",
  ELTERNZEIT: "parentalLeave",
  SONDERURLAUB: "specialLeave",
  UNBEZAHLT: "unpaidLeave",
  FORTBILDUNG: "training",
  SONSTIGES: "other",
};
