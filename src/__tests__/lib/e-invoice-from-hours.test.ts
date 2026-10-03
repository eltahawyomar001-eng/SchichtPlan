/**
 * Billing recorded time.
 *
 * The three rules under test each prevent a mistake that is invisible until a
 * customer's client complains: billing time that is still in review, billing
 * the same hours twice, and silently leaving work off an invoice because a
 * project had no rate.
 */
import { describe, it, expect } from "vitest";
import {
  collectBillableHours,
  previewNetCents,
  rateToCents,
  roundHours,
  type BillableEntry,
  type BillableProject,
} from "@/lib/e-invoice/from-hours";

const CLIENT = "cl_1";

const project = (over: Partial<BillableProject> = {}): BillableProject => ({
  id: "pr_1",
  name: "Objekt Parkallee",
  billRate: 28.5,
  clientId: CLIENT,
  ...over,
});

const entry = (over: Partial<BillableEntry> = {}): BillableEntry => ({
  id: "te_1",
  date: new Date("2026-09-01"),
  netMinutes: 480,
  status: "BESTAETIGT",
  projectId: "pr_1",
  invoicedItemId: null,
  ...over,
});

const run = (entries: BillableEntry[], projects = [project()]) =>
  collectBillableHours({ entries, projects, clientId: CLIENT });

const reasons = (r: ReturnType<typeof run>) => r.skipped.map((s) => s.reason);

describe("rounding", () => {
  it("rounds minutes to two decimal hours", () => {
    expect(roundHours(480)).toBe(8);
    expect(roundHours(450)).toBe(7.5);
    // 7h 37m = 7.61666... -> 7.62
    expect(roundHours(457)).toBe(7.62);
  });

  it("computes the line amount from the ROUNDED quantity", () => {
    // EN 16931 requires line amount = quantity x unit price (BR-CO-10).
    // Computing from exact minutes instead gives a line whose own arithmetic
    // does not check out, and the recipient's validator rejects it.
    const r = run([entry({ netMinutes: 457 })]);
    expect(r.lines[0].quantity).toBe(7.62);
    expect(previewNetCents(r.lines)).toBe(Math.round(7.62 * 2850));
  });

  it("keeps the unrounded minutes for the explanation", () => {
    const r = run([entry({ netMinutes: 457 })]);
    expect(r.lines[0].netMinutes).toBe(457);
  });

  it("converts a euro rate to integer cents", () => {
    expect(rateToCents(28.5)).toBe(2850);
    expect(rateToCents(33.333)).toBe(3333);
  });
});

describe("only confirmed time", () => {
  it("bills a confirmed entry", () => {
    const r = run([entry()]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].quantity).toBe(8);
  });

  for (const status of [
    "ENTWURF",
    "EINGEREICHT",
    "KORREKTUR",
    "ZURUECKGEWIESEN",
    "GEPRUEFT",
  ]) {
    it(`refuses ${status}`, () => {
      // GEPRUEFT is the trap: it sounds final but is one step short of
      // BESTAETIGT, and an entry there can still change -- which would mean
      // correcting an issued invoice by Storno.
      const r = run([entry({ status })]);
      expect(r.lines).toHaveLength(0);
      expect(reasons(r)).toEqual(["NOT_CONFIRMED"]);
    });
  }
});

describe("only once", () => {
  it("excludes an entry already on an invoice", () => {
    const r = run([entry({ invoicedItemId: "ci_1" })]);
    expect(r.lines).toHaveLength(0);
    expect(reasons(r)).toEqual(["ALREADY_INVOICED"]);
  });

  it("reports already-invoiced ahead of any other reason", () => {
    // The first reason reported should be the one the user can act on, and
    // changing the rate will not make billed hours billable again.
    const r = run(
      [entry({ invoicedItemId: "ci_1", status: "ENTWURF" })],
      [project({ billRate: null })],
    );
    expect(reasons(r)).toEqual(["ALREADY_INVOICED"]);
  });

  it("still bills the unclaimed entries alongside a claimed one", () => {
    const r = run([
      entry({ id: "a", invoicedItemId: "ci_1" }),
      entry({ id: "b", netMinutes: 60 }),
    ]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].entryIds).toEqual(["b"]);
    expect(r.lines[0].quantity).toBe(1);
  });
});

describe("only with a rate", () => {
  it("refuses a project with no rate rather than billing zero", () => {
    // A line at 0,00 EUR is an invoice silently short by a day's work, which
    // is worse than one that refuses to be built.
    const r = run([entry()], [project({ billRate: null })]);
    expect(r.lines).toHaveLength(0);
    expect(reasons(r)).toEqual(["NO_RATE"]);
  });

  it("refuses a zero or negative rate", () => {
    expect(reasons(run([entry()], [project({ billRate: 0 })]))).toEqual([
      "NO_RATE",
    ]);
    expect(reasons(run([entry()], [project({ billRate: -5 })]))).toEqual([
      "NO_RATE",
    ]);
  });

  it("refuses an entry with no project at all", () => {
    expect(reasons(run([entry({ projectId: null })]))).toEqual(["NO_PROJECT"]);
  });

  it("refuses an entry whose project belongs to another client", () => {
    // An employee can work across several clients in a week, and the entry
    // itself carries no client -- the project is where that lives.
    const r = run([entry()], [project({ clientId: "cl_other" })]);
    expect(reasons(r)).toEqual(["OTHER_CLIENT"]);
  });

  it("refuses an entry with no time on it", () => {
    expect(reasons(run([entry({ netMinutes: 0 })]))).toEqual(["NO_TIME"]);
  });
});

describe("grouping", () => {
  it("produces one line per project, with the hours summed", () => {
    const r = run(
      [
        entry({ id: "a", netMinutes: 480 }),
        entry({ id: "b", netMinutes: 240 }),
      ],
      [project()],
    );
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].quantity).toBe(12);
    expect(r.lines[0].entryIds).toEqual(["a", "b"]);
  });

  it("keeps separate projects on separate lines", () => {
    const r = run(
      [
        entry({ id: "a", projectId: "pr_1" }),
        entry({ id: "b", projectId: "pr_2" }),
      ],
      [
        project(),
        project({ id: "pr_2", name: "Objekt Rathaus", billRate: 31 }),
      ],
    );
    expect(r.lines).toHaveLength(2);
    expect(r.lines.map((l) => l.unitPriceCents)).toEqual([2850, 3100]);
  });

  it("orders lines by project name, so a redrawn draft looks the same", () => {
    const r = run(
      [
        entry({ id: "a", projectId: "pr_z" }),
        entry({ id: "b", projectId: "pr_a" }),
      ],
      [
        project({ id: "pr_z", name: "Zentrale" }),
        project({ id: "pr_a", name: "Außenstelle" }),
      ],
    );
    expect(r.lines.map((l) => l.projectId)).toEqual(["pr_a", "pr_z"]);
  });

  it("names the period in the line description", () => {
    // § 14 Abs. 4 Nr. 6 requires the time of supply, and a recipient checking
    // the invoice against their own records needs it per line.
    const r = run([
      entry({ id: "a", date: new Date("2026-09-01") }),
      entry({ id: "b", date: new Date("2026-09-30") }),
    ]);
    expect(r.lines[0].description).toContain("01.09.2026");
    expect(r.lines[0].description).toContain("30.09.2026");
  });

  it("reports the overall period across all lines", () => {
    const r = run(
      [
        entry({ id: "a", date: new Date("2026-09-05"), projectId: "pr_1" }),
        entry({ id: "b", date: new Date("2026-09-20"), projectId: "pr_2" }),
      ],
      [project(), project({ id: "pr_2", name: "B", billRate: 20 })],
    );
    expect(r.periodStart).toEqual(new Date("2026-09-05"));
    expect(r.periodEnd).toEqual(new Date("2026-09-20"));
  });
});

describe("nothing billable", () => {
  it("returns empty rather than throwing", () => {
    const r = run([]);
    expect(r).toMatchObject({
      lines: [],
      skipped: [],
      periodStart: null,
      periodEnd: null,
    });
  });

  it("still reports why, when everything was skipped", () => {
    // The skipped list is the useful part of an empty result.
    const r = run([entry({ status: "ENTWURF" })]);
    expect(r.lines).toHaveLength(0);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].projectName).toBe("Objekt Parkallee");
  });
});
