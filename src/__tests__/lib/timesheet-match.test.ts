// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalizeName,
  normalizePnr,
  similarity,
  buildEmployeeIndex,
  matchIdentity,
  type MatchableEmployee,
} from "@/lib/timesheet-match";

const employees: MatchableEmployee[] = [
  {
    id: "e1",
    firstName: "Max",
    lastName: "Mustermann",
    datevPersonnelNumber: null,
  },
  {
    id: "e2",
    firstName: "Marie",
    lastName: "antointe",
    datevPersonnelNumber: "123456",
  },
  {
    id: "e3",
    firstName: "Erika",
    lastName: "Schmidt",
    datevPersonnelNumber: null,
  },
];
const index = buildEmployeeIndex(employees);

describe("timesheet-match", () => {
  describe("normalizers", () => {
    it("normalizeName lowercases, strips accents, hyphens and extra spaces", () => {
      expect(normalizeName("Müller-Lüdenscheidt  ")).toBe(
        "muller ludenscheidt",
      );
    });
    it("normalizePnr keeps alphanumerics only", () => {
      expect(normalizePnr("123-456 ")).toBe("123456");
    });
    it("similarity is 1 for identical, lower for typos", () => {
      expect(similarity("Max Mustermann", "Max Mustermann")).toBe(1);
      expect(similarity("Max Mustermann", "Max Musterman")).toBeGreaterThan(
        0.85,
      );
      expect(similarity("Max", "Erika Schmidt")).toBeLessThan(0.5);
    });
  });

  describe("matchIdentity", () => {
    it("matches exactly by name (either ordering)", () => {
      expect(
        matchIdentity({ name: "Max Mustermann", personnelNumber: null }, index),
      ).toMatchObject({
        employeeId: "e1",
        kind: "matched",
      });
      expect(
        matchIdentity({ name: "Mustermann Max", personnelNumber: null }, index),
      ).toMatchObject({
        employeeId: "e1",
      });
    });

    it("matches by Personal-Nr. even when the name is misread", () => {
      const r = matchIdentity(
        { name: "Marri Antwanet", personnelNumber: "123456" },
        index,
      );
      expect(r.employeeId).toBe("e2");
      expect(r.kind).toBe("matched");
    });

    it("suggests the closest employee for a near-miss name", () => {
      const r = matchIdentity(
        { name: "Marie Antoinette", personnelNumber: null },
        index,
      );
      expect(r.employeeId).toBeNull();
      expect(r.suggestedEmployeeId).toBe("e2");
      expect(r.kind).toBe("suggested");
    });

    it("returns unmatched when nothing is close", () => {
      const r = matchIdentity(
        { name: "Zacharias Unbekannt", personnelNumber: null },
        index,
      );
      expect(r.employeeId).toBeNull();
      expect(r.suggestedEmployeeId).toBeNull();
      expect(r.kind).toBe("unmatched");
    });

    it("returns unmatched for an empty identity", () => {
      expect(
        matchIdentity({ name: null, personnelNumber: null }, index).kind,
      ).toBe("unmatched");
    });
  });
});
