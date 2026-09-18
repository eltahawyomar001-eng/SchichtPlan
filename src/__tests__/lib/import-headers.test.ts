/**
 * @vitest-environment node
 *
 * Header normalisation for POST /api/import.
 *
 * Regression: the upload hint tells users the columns are "first name, last
 * name, email (required), optional phone, position, hourly rate, weekly hours".
 * Every alias the importer looks up is space-free, so a spreadsheet built from
 * those instructions used to match nothing and import zero rows.
 */
import { describe, it, expect } from "vitest";
import { normalizeHeader } from "@/lib/import-headers";

describe("normalizeHeader", () => {
  it("trims and lowercases", () => {
    expect(normalizeHeader("  Vorname  ")).toBe("vorname");
    expect(normalizeHeader("EMAIL")).toBe("email");
  });

  it("collapses the spaces the on-screen upload hint tells users to type", () => {
    expect(normalizeHeader("First Name")).toBe("firstname");
    expect(normalizeHeader("Last Name")).toBe("lastname");
    expect(normalizeHeader("Hourly Rate")).toBe("hourlyrate");
    expect(normalizeHeader("Weekly Hours")).toBe("weeklyhours");
  });

  it("leaves the existing German and snake_case aliases untouched", () => {
    for (const alias of [
      "vorname",
      "nachname",
      "telefon",
      "stundenlohn",
      "wochenstunden",
      "first_name",
      "last_name",
      "startzeit",
      "pauseminuten",
    ]) {
      expect(normalizeHeader(alias)).toBe(alias);
    }
  });

  it("handles the empty and nullish cells exceljs hands back", () => {
    expect(normalizeHeader(null)).toBe("");
    expect(normalizeHeader(undefined)).toBe("");
    expect(normalizeHeader("")).toBe("");
    expect(normalizeHeader("   ")).toBe("");
  });

  it("collapses interior runs of whitespace, not just single spaces", () => {
    expect(normalizeHeader("First   Name")).toBe("firstname");
    expect(normalizeHeader("Hourly\tRate")).toBe("hourlyrate");
  });
});
