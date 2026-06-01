/**
 * @vitest-environment node
 *
 * ArbZG (Arbeitszeitgesetz) compliance helper tests.
 *
 * These are the pure (non-DB) helper functions that enforce German labor law
 * at scheduling time. Correctness here is legally significant — errors can
 * expose the employer to fines, so edge cases are tested exhaustively.
 *
 * §3  — max 10h worked per day
 * §4  — mandatory break: >6h→30min break, >9h→45min break
 * §5  — min 11h uninterrupted rest between shifts
 */
import { describe, it, expect } from "vitest";
import {
  shiftGrossMinutes,
  requiredBreakForNet,
  suggestBreakForGross,
  checkArbZg4BreakRequirement,
  ARBZG_REST_HOURS,
} from "@/lib/arbzg";

// ─── Constants ──────────────────────────────────────────────────

describe("ARBZG_REST_HOURS", () => {
  it("is 11 hours (ArbZG §5)", () => {
    expect(ARBZG_REST_HOURS).toBe(11);
  });
});

// ─── shiftGrossMinutes ───────────────────────────────────────────

describe("shiftGrossMinutes", () => {
  it("calculates a standard day shift", () => {
    expect(shiftGrossMinutes("08:00", "16:00")).toBe(480); // 8h
  });

  it("calculates a short morning shift", () => {
    expect(shiftGrossMinutes("06:00", "10:00")).toBe(240); // 4h
  });

  it("handles overnight shifts where end < start", () => {
    // 22:00 to 06:00 next day = 8h
    expect(shiftGrossMinutes("22:00", "06:00")).toBe(480);
  });

  it("handles midnight crossing (22:00 to 00:00 = 2h)", () => {
    expect(shiftGrossMinutes("22:00", "00:00")).toBe(120);
  });

  it("calculates exactly 6 hours", () => {
    expect(shiftGrossMinutes("09:00", "15:00")).toBe(360);
  });

  it("calculates exactly 9 hours", () => {
    expect(shiftGrossMinutes("08:00", "17:00")).toBe(540);
  });

  it("calculates a 10-hour shift (ArbZG §3 maximum)", () => {
    expect(shiftGrossMinutes("08:00", "18:00")).toBe(600);
  });

  it("handles times with non-zero minutes", () => {
    expect(shiftGrossMinutes("08:30", "16:45")).toBe(495); // 8h 15min
  });

  it("handles 12-hour overnight shift", () => {
    expect(shiftGrossMinutes("20:00", "08:00")).toBe(720);
  });
});

// ─── requiredBreakForNet ─────────────────────────────────────────

describe("requiredBreakForNet — ArbZG §4", () => {
  // ≤ 6h: no mandatory break
  it("requires no break for exactly 6h (360min)", () => {
    expect(requiredBreakForNet(360)).toBe(0);
  });

  it("requires no break for under 6h", () => {
    expect(requiredBreakForNet(359)).toBe(0);
    expect(requiredBreakForNet(240)).toBe(0);
    expect(requiredBreakForNet(0)).toBe(0);
  });

  // > 6h: 30 min break required
  it("requires 30min break for 6h 1min (361min)", () => {
    expect(requiredBreakForNet(361)).toBe(30);
  });

  it("requires 30min break for 7h (420min)", () => {
    expect(requiredBreakForNet(420)).toBe(30);
  });

  it("requires 30min break for exactly 9h (540min)", () => {
    expect(requiredBreakForNet(540)).toBe(30);
  });

  // > 9h: 45 min break required
  it("requires 45min break for 9h 1min (541min)", () => {
    expect(requiredBreakForNet(541)).toBe(45);
  });

  it("requires 45min break for 10h (600min)", () => {
    expect(requiredBreakForNet(600)).toBe(45);
  });

  it("requires 45min break for 12h", () => {
    expect(requiredBreakForNet(720)).toBe(45);
  });
});

// ─── suggestBreakForGross ────────────────────────────────────────

describe("suggestBreakForGross", () => {
  it("suggests 0 min break for ≤6h gross", () => {
    expect(suggestBreakForGross(360)).toBe(0); // exactly 6h
    expect(suggestBreakForGross(240)).toBe(0); // 4h
    expect(suggestBreakForGross(300)).toBe(0); // 5h
  });

  // 6h01min gross → net after 0min break = 361min > 6h → needs 30min → suggest 30
  it("suggests 30min break for gross > 6h up to ~9.5h", () => {
    expect(suggestBreakForGross(361)).toBe(30); // 6h01m gross
    expect(suggestBreakForGross(480)).toBe(30); // 8h gross
    expect(suggestBreakForGross(540)).toBe(30); // 9h gross (540-30=510 ≤ 540, ok)
  });

  // For gross = 570min (9h30m): net after 30min = 540min = 9h → needs 30min → ok
  // For gross = 571min (9h31m): net after 30min = 541min > 9h → needs 45min → suggest 45
  it("suggests 45min break for gross > 9h30m", () => {
    expect(suggestBreakForGross(571)).toBe(45);
    expect(suggestBreakForGross(600)).toBe(45); // 10h
    expect(suggestBreakForGross(720)).toBe(45); // 12h
  });

  it("returns 45 for unrealistically long shifts", () => {
    expect(suggestBreakForGross(1440)).toBe(45); // 24h
  });
});

// ─── checkArbZg4BreakRequirement ────────────────────────────────

describe("checkArbZg4BreakRequirement — ArbZG §4 hard block", () => {
  describe("no violation cases", () => {
    it("no violation for a 6h shift with no break", () => {
      const r = checkArbZg4BreakRequirement("09:00", "15:00", 0);
      expect(r.violation).toBe(false);
      expect(r.required).toBe(false);
      expect(r.minBreakMinutes).toBe(0);
    });

    it("no violation for 8h with 30min break (net = 450min ≤ 540min)", () => {
      const r = checkArbZg4BreakRequirement("08:00", "16:00", 30);
      expect(r.violation).toBe(false);
      expect(r.minBreakMinutes).toBe(30);
    });

    it("no violation for 10h with 45min break (net = 555min > 540 but break satisfies)", () => {
      const r = checkArbZg4BreakRequirement("08:00", "18:00", 45);
      expect(r.violation).toBe(false);
    });

    it("no violation for 10h with 60min break (more than required)", () => {
      const r = checkArbZg4BreakRequirement("08:00", "18:00", 60);
      expect(r.violation).toBe(false);
    });

    it("no violation for 6h with no break (exactly at threshold)", () => {
      const r = checkArbZg4BreakRequirement("10:00", "16:00", 0);
      expect(r.violation).toBe(false);
      expect(r.required).toBe(false);
    });
  });

  describe("violation cases", () => {
    it("violation: 8h shift with no break (net 480min > 360min threshold)", () => {
      const r = checkArbZg4BreakRequirement("08:00", "16:00", 0);
      expect(r.violation).toBe(true);
      expect(r.required).toBe(true);
      expect(r.minBreakMinutes).toBe(30);
      expect(r.message).toContain("§4");
      expect(r.message).toContain("30");
      expect(r.messageEn).toContain("§4");
    });

    it("violation: 10h shift with no break", () => {
      const r = checkArbZg4BreakRequirement("08:00", "18:00", 0);
      expect(r.violation).toBe(true);
      expect(r.minBreakMinutes).toBe(45);
      expect(r.message).toContain("45");
    });

    it("violation: 10h shift with only 30min break (needs 45min)", () => {
      const r = checkArbZg4BreakRequirement("08:00", "18:00", 30);
      expect(r.violation).toBe(true);
      expect(r.minBreakMinutes).toBe(45);
    });

    it("violation: 9h shift with 29min break (needs 30min)", () => {
      const r = checkArbZg4BreakRequirement("08:00", "17:00", 29);
      expect(r.violation).toBe(true);
      expect(r.minBreakMinutes).toBe(30);
    });
  });

  describe("edge cases", () => {
    it("defaults break to 0 when not provided", () => {
      const r = checkArbZg4BreakRequirement("08:00", "16:00");
      expect(r.violation).toBe(true); // 8h no break
      expect(r.minBreakMinutes).toBe(30);
    });

    it("handles overnight shifts", () => {
      // 22:00 to 06:00 = 8h gross, 0 break → violation
      const r = checkArbZg4BreakRequirement("22:00", "06:00", 0);
      expect(r.violation).toBe(true);
      expect(r.minBreakMinutes).toBe(30);
    });

    it("overnight shift with adequate break", () => {
      const r = checkArbZg4BreakRequirement("22:00", "06:00", 30);
      expect(r.violation).toBe(false);
    });

    it("correctly reports netMinutes", () => {
      const r = checkArbZg4BreakRequirement("08:00", "16:00", 30);
      expect(r.netMinutes).toBe(450); // 480 - 30
    });
  });
});
