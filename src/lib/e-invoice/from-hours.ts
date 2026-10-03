/**
 * Turning recorded time into invoice lines.
 *
 * This is the point of the product: the hours are already in the system, and
 * retyping them into separate invoicing software is both the work customers
 * want removed and the step where the two records drift apart.
 *
 * Three rules decide what may be billed, and all three exist because breaking
 * them is expensive in a way that is not obvious until it happens:
 *
 *   Only CONFIRMED time. An entry still in review can change, and an invoice
 *   built on it would have to be corrected by a Storno once it does.
 *
 *   Only once. An entry that has already been put on an invoice is excluded
 *   by the link the first invoice left behind, not by a date filter -- date
 *   filters overlap, and billing the same week twice is the mistake the
 *   customer's client notices rather than we do.
 *
 *   Only with a rate. A project with no billRate produces no line at all,
 *   rather than a line at zero: an invoice silently short by a day's work is
 *   worse than one that refuses to be built.
 */

/** A confirmed entry, as far as billing is concerned. */
export interface BillableEntry {
  id: string;
  date: Date;
  netMinutes: number;
  status: string;
  projectId: string | null;
  /** Set once the entry has been placed on an invoice. */
  invoicedItemId: string | null;
}

export interface BillableProject {
  id: string;
  name: string;
  /** Euro per hour. Null means the project is not billable. */
  billRate: number | null;
  clientId: string | null;
}

/** Why an entry was left out, so the UI can say so rather than silently drop it. */
export type SkipReason =
  | "NOT_CONFIRMED"
  | "ALREADY_INVOICED"
  | "NO_PROJECT"
  | "NO_RATE"
  | "OTHER_CLIENT"
  | "NO_TIME";

export interface SkippedEntry {
  entryId: string;
  date: Date;
  netMinutes: number;
  reason: SkipReason;
  projectName?: string;
}

export interface HoursLine {
  projectId: string;
  description: string;
  /** Hours, rounded to two decimals. See roundHours. */
  quantity: number;
  unitPriceCents: number;
  unitCode: "HUR";
  /** The entries this line bills, so they can be linked and not billed again. */
  entryIds: string[];
  /** Unrounded, for the explanation in the UI. */
  netMinutes: number;
}

export interface CollectResult {
  lines: HoursLine[];
  skipped: SkippedEntry[];
  /** Period actually covered, for BG-14 and the line descriptions. */
  periodStart: Date | null;
  periodEnd: Date | null;
}

/**
 * Minutes as billable hours, to two decimals.
 *
 * Rounded HERE, and the line amount is then computed from this rounded figure
 * rather than from the exact minutes. EN 16931 requires the line amount to
 * equal quantity x unit price (BR-CO-10); computing it from the exact minutes
 * instead produces a line whose own arithmetic does not check out, and the
 * recipient's validator rejects it.
 *
 * The cost is at most half a cent per line against the exact figure, which is
 * the normal and expected behaviour of an hourly invoice.
 */
export function roundHours(netMinutes: number): number {
  return Math.round((netMinutes / 60) * 100) / 100;
}

/** Euro-per-hour as integer cents. */
export function rateToCents(billRate: number): number {
  return Math.round(billRate * 100);
}

function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Billable lines for one client over a period.
 *
 * `clientId` filters by the project's client rather than by anything on the
 * entry, because that is where the commercial relationship actually lives: an
 * employee can work across several clients in a week, and their time entries
 * carry no client of their own.
 */
export function collectBillableHours(input: {
  entries: BillableEntry[];
  projects: BillableProject[];
  clientId: string;
}): CollectResult {
  const byId = new Map(input.projects.map((p) => [p.id, p]));
  const skipped: SkippedEntry[] = [];
  const groups = new Map<
    string,
    { project: BillableProject; entries: BillableEntry[] }
  >();

  for (const e of input.entries) {
    const project = e.projectId ? byId.get(e.projectId) : undefined;
    const note = (reason: SkipReason) =>
      skipped.push({
        entryId: e.id,
        date: e.date,
        netMinutes: e.netMinutes,
        reason,
        projectName: project?.name,
      });

    // Order matters: the FIRST true reason is the one reported, and it should
    // be the one the user can act on. "Already invoiced" outranks "no rate",
    // because changing the rate will not make it billable again.
    if (e.invoicedItemId) {
      note("ALREADY_INVOICED");
      continue;
    }
    if (e.status !== "BESTAETIGT") {
      note("NOT_CONFIRMED");
      continue;
    }
    if (!project) {
      note("NO_PROJECT");
      continue;
    }
    if (project.clientId !== input.clientId) {
      note("OTHER_CLIENT");
      continue;
    }
    if (project.billRate === null || project.billRate <= 0) {
      note("NO_RATE");
      continue;
    }
    if (e.netMinutes <= 0) {
      note("NO_TIME");
      continue;
    }

    const g = groups.get(project.id);
    if (g) g.entries.push(e);
    else groups.set(project.id, { project, entries: [e] });
  }

  const lines: HoursLine[] = [];
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  // Sorted by project name so a regenerated draft has the same line order as
  // the one the user looked at a moment ago.
  const ordered = [...groups.values()].sort((a, b) =>
    a.project.name.localeCompare(b.project.name, "de"),
  );

  for (const { project, entries } of ordered) {
    const netMinutes = entries.reduce((s, e) => s + e.netMinutes, 0);
    const dates = entries.map((e) => e.date.getTime());
    const from = new Date(Math.min(...dates));
    const to = new Date(Math.max(...dates));

    if (!periodStart || from < periodStart) periodStart = from;
    if (!periodEnd || to > periodEnd) periodEnd = to;

    lines.push({
      projectId: project.id,
      // The period is in the description because § 14 Abs. 4 Nr. 6 requires
      // the time of supply, and a recipient checking the invoice against
      // their own records needs it per line, not only on the document.
      description: `${project.name} (${deDate(from)} – ${deDate(to)})`,
      quantity: roundHours(netMinutes),
      unitPriceCents: rateToCents(project.billRate!),
      unitCode: "HUR",
      entryIds: entries.map((e) => e.id),
      netMinutes,
    });
  }

  return { lines, skipped, periodStart, periodEnd };
}

/** Net total of the collected lines, in cents. Preview only. */
export function previewNetCents(lines: HoursLine[]): number {
  return lines.reduce(
    (s, l) => s + Math.round(l.quantity * l.unitPriceCents),
    0,
  );
}
