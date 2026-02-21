/**
 * Industrieminuten – convert between HH:MM and decimal hours.
 *
 * In Germany, "Industrieminuten" refers to the decimal representation of
 * work time.  1 Industrieminute = 1/100 hour, so 15 real minutes = 0.25 h.
 *
 * @example
 *   toIndustrialHours(8, 30) // => 8.50
 *   fromIndustrialHours(8.50) // => { hours: 8, minutes: 30 }
 *   formatIndustrialHours(8.50) // => "8,50"
 *   minutesToIndustrial(510) // => 8.50
 */

/**
 * Convert hours + minutes to decimal hours (Industriestunden).
 */
export function toIndustrialHours(hours: number, minutes: number): number {
  return Math.round((hours + minutes / 60) * 100) / 100;
}

/**
 * Convert a total number of minutes to decimal hours.
 */
export function minutesToIndustrial(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100;
}

/**
 * Convert decimal hours back to hours + minutes.
 */
export function fromIndustrialHours(industrial: number): {
  hours: number;
  minutes: number;
} {
  const hours = Math.floor(industrial);
  const minutes = Math.round((industrial - hours) * 60);
  return { hours, minutes };
}

/**
 * Format decimal hours as a string with comma separator (German style).
 * e.g. 8.50 → "8,50"
 */
export function formatIndustrialHours(industrial: number): string {
  return industrial.toFixed(2).replace(".", ",");
}

/**
 * Parse a "HH:MM" string and return decimal hours.
 */
export function parseTimeToIndustrial(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return toIndustrialHours(h ?? 0, m ?? 0);
}

/**
 * Format a duration in minutes as "Xh Ym".
 */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
