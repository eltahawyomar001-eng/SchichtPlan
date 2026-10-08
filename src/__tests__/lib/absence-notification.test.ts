/**
 * The wording an employee actually receives.
 *
 * The specified sentence is exact, and the reason it is exact is that the push
 * has to be actionable without opening the app. Somebody with two requests in
 * flight cannot do anything with "Ihre Abwesenheit wurde genehmigt".
 */
import { describe, it, expect } from "vitest";
import { absenceDecisionMessage, deDate } from "@/lib/absence-notification";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("the specified wording", () => {
  it("matches the approval example exactly", () => {
    const { body } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-06"),
      approved: true,
    });
    expect(body).toBe(
      "Ihr Urlaubsantrag für den Zeitraum vom 01.10.2026 bis zum 06.10.2026 wurde genehmigt.",
    );
  });

  it("matches the rejection example exactly", () => {
    const { body } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-06"),
      approved: false,
    });
    expect(body).toBe(
      "Ihr Urlaubsantrag für den Zeitraum vom 01.10.2026 bis zum 06.10.2026 wurde abgelehnt.",
    );
  });
});

describe("dates", () => {
  it("writes them the German way, zero padded", () => {
    expect(deDate(d("2026-01-05"))).toBe("05.01.2026");
  });

  it("reads naturally for a single day", () => {
    // "vom 05.10.2026 bis zum 05.10.2026" looks like a bug to the reader.
    const { body } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-10-05"),
      endDate: d("2026-10-05"),
      approved: true,
    });
    expect(body).toBe("Ihr Urlaubsantrag für den 05.10.2026 wurde genehmigt.");
  });

  it("handles a period spanning a year boundary", () => {
    const { body } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-12-27"),
      endDate: d("2027-01-03"),
      approved: true,
    });
    expect(body).toContain("vom 27.12.2026 bis zum 03.01.2027");
  });
});

describe("the kind of request", () => {
  it("says Urlaubsantrag for Urlaub", () => {
    // People book flights against a Urlaub. The word they used when asking is
    // the word they should get back.
    const { body } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-02"),
      approved: true,
    });
    expect(body).toContain("Urlaubsantrag");
  });

  it("distinguishes Sonderurlaub", () => {
    const { body } = absenceDecisionMessage({
      category: "SONDERURLAUB",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-02"),
      approved: true,
    });
    expect(body).toContain("Sonderurlaubsantrag");
  });

  it("falls back to the generic term rather than inventing a compound", () => {
    const { body } = absenceDecisionMessage({
      category: "SONSTIGES",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-02"),
      approved: false,
    });
    expect(body).toContain("Abwesenheitsantrag");
    expect(body).toContain("wurde abgelehnt.");
  });

  it("uses a readable phrase where no compound exists", () => {
    const { body } = absenceDecisionMessage({
      category: "ELTERNZEIT",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-02"),
      approved: true,
    });
    expect(body).toContain("Antrag auf Elternzeit");
  });
});

describe("the title", () => {
  it("already names the request and the verdict", () => {
    // A lock-screen banner often shows little more than this.
    const { title } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-06"),
      approved: true,
    });
    expect(title).toBe("Urlaubsantrag genehmigt");
  });

  it("says rejected when rejected", () => {
    const { title } = absenceDecisionMessage({
      category: "URLAUB",
      startDate: d("2026-10-01"),
      endDate: d("2026-10-06"),
      approved: false,
    });
    expect(title).toBe("Urlaubsantrag abgelehnt");
  });
});
