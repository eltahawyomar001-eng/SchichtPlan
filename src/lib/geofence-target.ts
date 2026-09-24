import { prisma } from "@/lib/db";

/**
 * Work out which object a punch or a proof photo should be measured against.
 *
 * Without this the geofence silently does nothing. A site can be geocoded,
 * enforced and have a radius set, and every photo still reads "Site not
 * geocoded" -- not because the site lacks coordinates, but because nothing
 * connected the photo to it. That is a confusing failure to sit in front of,
 * because the screen showing the problem is not the screen with the gap.
 *
 * The clock route and the proof route had drifted: the clock route fell back to
 * the employee's own object, the proof route gave up after the shift. Same
 * question, two answers. It is resolved here so they cannot disagree.
 */

export interface TargetHints {
  /** Explicitly chosen by the client, e.g. after scanning a QR station. */
  locationId?: string | null;
  timeEntryId?: string | null;
  shiftId?: string | null;
  employeeId?: string | null;
}

/**
 * Most specific source first.
 *
 * Every step is an increasingly weak claim about where the work happened, so
 * the order is the order of confidence: what the client said, what the punch
 * recorded, what the roster planned, where this person normally works, and
 * finally -- only when it cannot be ambiguous -- the workspace's single object.
 */
export async function resolveGeofenceTargetId(
  workspaceId: string,
  hints: TargetHints,
): Promise<string | null> {
  if (hints.locationId) return hints.locationId;

  if (hints.timeEntryId) {
    const entry = await prisma.timeEntry.findFirst({
      where: { id: hints.timeEntryId, workspaceId },
      select: { locationId: true },
    });
    if (entry?.locationId) return entry.locationId;
  }

  if (hints.shiftId) {
    const shift = await prisma.shift.findFirst({
      where: { id: hints.shiftId, workspaceId },
      select: { locationId: true },
    });
    if (shift?.locationId) return shift.locationId;
  }

  if (hints.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: hints.employeeId, workspaceId },
      select: { locationId: true },
    });
    if (employee?.locationId) return employee.locationId;
  }

  /**
   * One object in the workspace means there is nothing to be wrong about.
   *
   * This is the case that makes a small customer's geofence work at all: they
   * add their one site, geocode it, enforce it, and never assign anyone to it
   * because with a single object there is nothing to choose between. Refusing
   * to infer it leaves the feature switched on and doing nothing.
   *
   * Strictly better than the old answer too. Attributing a punch made 50 km
   * away to that object reports OUTSIDE, which is true and actionable;
   * resolving nothing reported "cannot be checked", which told nobody anything.
   *
   * Deliberately stops at exactly one: with two objects, guessing would put a
   * worker at the wrong site, and a wrong verdict is worse than no verdict.
   */
  const candidates = await prisma.location.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true },
    take: 2,
  });
  return candidates.length === 1 ? candidates[0].id : null;
}
