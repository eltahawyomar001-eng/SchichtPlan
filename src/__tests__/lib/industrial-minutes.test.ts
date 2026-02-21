import { describe, it, expect } from "vitest";
import {
  toIndustrialHours,
  minutesToIndustrial,
  fromIndustrialHours,
  formatIndustrialHours,
  parseTimeToIndustrial,
  formatDuration,
} from "@/lib/industrial-minutes";

describe("Industrial Minutes", () => {
  describe("toIndustrialHours", () => {
    it("converts 8h 30m to 8.50", () => {
      expect(toIndustrialHours(8, 30)).toBe(8.5);
    });
    it("converts 0h 15m to 0.25", () => {
      expect(toIndustrialHours(0, 15)).toBe(0.25);
    });
    it("converts 7h 45m to 7.75", () => {
      expect(toIndustrialHours(7, 45)).toBe(7.75);
    });
    it("converts 8h 0m to 8.00", () => {
      expect(toIndustrialHours(8, 0)).toBe(8);
    });
  });

  describe("minutesToIndustrial", () => {
    it("converts 510 min to 8.50", () => {
      expect(minutesToIndustrial(510)).toBe(8.5);
    });
    it("converts 60 min to 1.00", () => {
      expect(minutesToIndustrial(60)).toBe(1);
    });
  });

  describe("fromIndustrialHours", () => {
    it("converts 8.5 to 8h 30m", () => {
      expect(fromIndustrialHours(8.5)).toEqual({ hours: 8, minutes: 30 });
    });
    it("converts 7.75 to 7h 45m", () => {
      expect(fromIndustrialHours(7.75)).toEqual({ hours: 7, minutes: 45 });
    });
  });

  describe("formatIndustrialHours", () => {
    it("formats 8.5 as '8,50'", () => {
      expect(formatIndustrialHours(8.5)).toBe("8,50");
    });
    it("formats 0.25 as '0,25'", () => {
      expect(formatIndustrialHours(0.25)).toBe("0,25");
    });
  });

  describe("parseTimeToIndustrial", () => {
    it("parses '08:30' to 8.50", () => {
      expect(parseTimeToIndustrial("08:30")).toBe(8.5);
    });
    it("parses '07:45' to 7.75", () => {
      expect(parseTimeToIndustrial("07:45")).toBe(7.75);
    });
  });

  describe("formatDuration", () => {
    it("formats 90 min as '1h 30m'", () => {
      expect(formatDuration(90)).toBe("1h 30m");
    });
    it("formats 60 min as '1h'", () => {
      expect(formatDuration(60)).toBe("1h");
    });
    it("formats 45 min as '45m'", () => {
      expect(formatDuration(45)).toBe("45m");
    });
  });
});
