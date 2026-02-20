/**
 * German public holidays (Feiertage) per Bundesland.
 * Includes both fixed-date and moveable (Easter-based) holidays.
 */

// Easter calculation using Gauss algorithm
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

export interface HolidayDefinition {
  name: string;
  date: string; // YYYY-MM-DD
  bundeslaender: string[]; // Which states observe this
  isNational: boolean;
}

/** All 16 German Bundesländer */
export const BUNDESLAENDER: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

const ALL = Object.keys(BUNDESLAENDER);

export function getGermanHolidays(year: number): HolidayDefinition[] {
  const easter = getEasterDate(year);

  const holidays: HolidayDefinition[] = [
    // ── National holidays (all states) ──
    {
      name: "Neujahr",
      date: `${year}-01-01`,
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "Tag der Arbeit",
      date: `${year}-05-01`,
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "Tag der Deutschen Einheit",
      date: `${year}-10-03`,
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "1. Weihnachtstag",
      date: `${year}-12-25`,
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "2. Weihnachtstag",
      date: `${year}-12-26`,
      bundeslaender: ALL,
      isNational: true,
    },
    // Easter-based national
    {
      name: "Karfreitag",
      date: dateStr(addDays(easter, -2)),
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "Ostermontag",
      date: dateStr(addDays(easter, 1)),
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "Christi Himmelfahrt",
      date: dateStr(addDays(easter, 39)),
      bundeslaender: ALL,
      isNational: true,
    },
    {
      name: "Pfingstmontag",
      date: dateStr(addDays(easter, 50)),
      bundeslaender: ALL,
      isNational: true,
    },

    // ── Regional holidays ──
    {
      name: "Heilige Drei Könige",
      date: `${year}-01-06`,
      bundeslaender: ["BW", "BY", "ST"],
      isNational: false,
    },
    {
      name: "Internationaler Frauentag",
      date: `${year}-03-08`,
      bundeslaender: ["BE", "MV"],
      isNational: false,
    },
    {
      name: "Fronleichnam",
      date: dateStr(addDays(easter, 60)),
      bundeslaender: ["BW", "BY", "HE", "NW", "RP", "SL"],
      isNational: false,
    },
    {
      name: "Mariä Himmelfahrt",
      date: `${year}-08-15`,
      bundeslaender: ["BY", "SL"],
      isNational: false,
    },
    {
      name: "Weltkindertag",
      date: `${year}-09-20`,
      bundeslaender: ["TH"],
      isNational: false,
    },
    {
      name: "Reformationstag",
      date: `${year}-10-31`,
      bundeslaender: ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"],
      isNational: false,
    },
    {
      name: "Allerheiligen",
      date: `${year}-11-01`,
      bundeslaender: ["BW", "BY", "NW", "RP", "SL"],
      isNational: false,
    },
    {
      name: "Buß- und Bettag",
      date: dateStr(getBussUndBettag(year)),
      bundeslaender: ["SN"],
      isNational: false,
    },
  ];

  return holidays;
}

/** Buß- und Bettag: Wednesday before the last Sunday before Advent */
function getBussUndBettag(year: number): Date {
  // Nov 23 is always the latest possible date
  const nov23 = new Date(year, 10, 23);
  const dayOfWeek = nov23.getDay();
  // Find the Wednesday on or before Nov 22
  // Buß- und Bettag is 11 days before the first Advent Sunday
  // which is the same as the Wednesday before Nov 23 that falls on a Wednesday
  const daysToSubtract = dayOfWeek === 3 ? 0 : (dayOfWeek + 4) % 7;
  return addDays(nov23, -daysToSubtract);
}

/**
 * Check if a date is a public holiday for a given Bundesland.
 */
export function isPublicHoliday(
  date: Date,
  bundesland: string,
): { isHoliday: boolean; name?: string } {
  const year = date.getFullYear();
  const holidays = getGermanHolidays(year);
  const dStr = dateStr(date);

  const match = holidays.find(
    (h) =>
      h.date === dStr && (h.isNational || h.bundeslaender.includes(bundesland)),
  );

  return match ? { isHoliday: true, name: match.name } : { isHoliday: false };
}

/**
 * Check if a date is a Sunday.
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Calculate surcharge percentage based on shift characteristics.
 * Standard German surcharges:
 * - Night work (23:00-06:00): 25%
 * - Sunday work: 50%
 * - Holiday work: 150%
 */
export function calculateSurcharge(opts: {
  isNight: boolean;
  isSunday: boolean;
  isHoliday: boolean;
}): number {
  let surcharge = 0;
  if (opts.isNight) surcharge += 25;
  if (opts.isSunday) surcharge += 50;
  if (opts.isHoliday) surcharge += 150;
  return surcharge;
}

/**
 * Determine if a shift is a night shift.
 * A shift is considered a night shift if it overlaps with 23:00-06:00.
 */
export function isNightShift(startTime: string, endTime: string): boolean {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  // Night window: 23:00 (1380) to 06:00 (360)
  const nightStart = 23 * 60; // 1380
  const nightEnd = 6 * 60; // 360

  // Overnight shift
  if (endMin < startMin) return true;

  // Starts before 06:00
  if (startMin < nightEnd) return true;

  // Ends after 23:00
  if (endMin > nightStart) return true;

  return false;
}
