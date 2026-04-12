/**
 * @vitest-environment node
 *
 * Tests for Zod validation schemas and the validateBody helper.
 * Covers:
 *   - Schema boundary values (clockActionSchema, createAbsenceSchema, monthCloseSchema)
 *   - XSS sanitization in validateBody / deepSanitize
 *   - German enum validation
 *   - Error structure
 */
import { describe, it, expect } from "vitest";
import {
  validateBody,
  clockActionSchema,
  createAbsenceSchema,
  monthCloseSchema,
  createShiftSchema,
  createEmployeeSchema,
  timeEntryStatusSchema,
  updateAbsenceStatusSchema,
} from "@/lib/validations";

/* ══════════════════════════════════════════════════════════════════
   clockActionSchema
   ══════════════════════════════════════════════════════════════════ */

describe("clockActionSchema", () => {
  it("accepts 'in' action", () => {
    const result = validateBody(clockActionSchema, { action: "in" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.action).toBe("in");
  });

  it("accepts 'out' action", () => {
    const result = validateBody(clockActionSchema, { action: "out" });
    expect(result.success).toBe(true);
  });

  it("accepts 'break-start' action", () => {
    const result = validateBody(clockActionSchema, { action: "break-start" });
    expect(result.success).toBe(true);
  });

  it("accepts 'break-end' action", () => {
    const result = validateBody(clockActionSchema, { action: "break-end" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = validateBody(clockActionSchema, { action: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing action", () => {
    const result = validateBody(clockActionSchema, {});
    expect(result.success).toBe(false);
  });

  it("accepts optional timezone", () => {
    const result = validateBody(clockActionSchema, {
      action: "in",
      timezone: "Europe/Berlin",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.timezone).toBe("Europe/Berlin");
  });
});

/* ══════════════════════════════════════════════════════════════════
   createAbsenceSchema
   ══════════════════════════════════════════════════════════════════ */

describe("createAbsenceSchema", () => {
  const valid = {
    employeeId: "emp-1",
    category: "URLAUB",
    startDate: "2025-03-10",
    endDate: "2025-03-14",
  };

  it("accepts valid absence data", () => {
    const result = validateBody(createAbsenceSchema, valid);
    expect(result.success).toBe(true);
  });

  it("accepts all German absence categories", () => {
    const categories = [
      "URLAUB",
      "KRANK",
      "UNBEZAHLT",
      "SONDERURLAUB",
      "ELTERNZEIT",
      "FORTBILDUNG",
      "SONSTIGES",
    ];
    for (const category of categories) {
      const result = validateBody(createAbsenceSchema, {
        ...valid,
        category,
      });
      expect(result.success, `category ${category} should be valid`).toBe(true);
    }
  });

  it("rejects invalid category", () => {
    const result = validateBody(createAbsenceSchema, {
      ...valid,
      category: "VACATION",
    });
    expect(result.success).toBe(false);
  });

  it("rejects FEIERTAG (removed from schema)", () => {
    const result = validateBody(createAbsenceSchema, {
      ...valid,
      category: "FEIERTAG",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing employeeId", () => {
    const { employeeId: _employeeId, ...noEmpId } = valid;
    const result = validateBody(createAbsenceSchema, noEmpId);
    expect(result.success).toBe(false);
  });

  it("rejects empty startDate", () => {
    const result = validateBody(createAbsenceSchema, {
      ...valid,
      startDate: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults halfDayStart to false", () => {
    const result = validateBody(createAbsenceSchema, valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.halfDayStart).toBe(false);
  });

  it("accepts halfDayStart and halfDayEnd booleans", () => {
    const result = validateBody(createAbsenceSchema, {
      ...valid,
      halfDayStart: true,
      halfDayEnd: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.halfDayStart).toBe(true);
      expect(result.data.halfDayEnd).toBe(true);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
   monthCloseSchema
   ══════════════════════════════════════════════════════════════════ */

describe("monthCloseSchema", () => {
  it("accepts valid lock action", () => {
    const result = validateBody(monthCloseSchema, {
      year: 2025,
      month: 1,
      action: "lock",
    });
    expect(result.success).toBe(true);
  });

  it("accepts unlock and export actions", () => {
    for (const action of ["unlock", "export"]) {
      const result = validateBody(monthCloseSchema, {
        year: 2025,
        month: 6,
        action,
      });
      expect(result.success, `action ${action} should be valid`).toBe(true);
    }
  });

  it("rejects invalid action", () => {
    const result = validateBody(monthCloseSchema, {
      year: 2025,
      month: 1,
      action: "freeze",
    });
    expect(result.success).toBe(false);
  });

  it("rejects month 0", () => {
    const result = validateBody(monthCloseSchema, {
      year: 2025,
      month: 0,
      action: "lock",
    });
    expect(result.success).toBe(false);
  });

  it("rejects month 13", () => {
    const result = validateBody(monthCloseSchema, {
      year: 2025,
      month: 13,
      action: "lock",
    });
    expect(result.success).toBe(false);
  });

  it("rejects year below 2020", () => {
    const result = validateBody(monthCloseSchema, {
      year: 2019,
      month: 1,
      action: "lock",
    });
    expect(result.success).toBe(false);
  });

  it("rejects year above 2100", () => {
    const result = validateBody(monthCloseSchema, {
      year: 2101,
      month: 1,
      action: "lock",
    });
    expect(result.success).toBe(false);
  });

  it("coerces string year/month to numbers", () => {
    const result = validateBody(monthCloseSchema, {
      year: "2025",
      month: "3",
      action: "lock",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.year).toBe(2025);
      expect(result.data.month).toBe(3);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
   createShiftSchema
   ══════════════════════════════════════════════════════════════════ */

describe("createShiftSchema", () => {
  it("accepts valid shift", () => {
    const result = validateBody(createShiftSchema, {
      date: "2025-03-10",
      startTime: "08:00",
      endTime: "16:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid time format", () => {
    const result = validateBody(createShiftSchema, {
      date: "2025-03-10",
      startTime: "8am",
      endTime: "16:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional repeatWeeks", () => {
    const result = validateBody(createShiftSchema, {
      date: "2025-03-10",
      startTime: "08:00",
      endTime: "16:00",
      repeatWeeks: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.repeatWeeks).toBe(4);
  });

  it("rejects repeatWeeks > 52", () => {
    const result = validateBody(createShiftSchema, {
      date: "2025-03-10",
      startTime: "08:00",
      endTime: "16:00",
      repeatWeeks: 53,
    });
    expect(result.success).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   timeEntryStatusSchema
   ══════════════════════════════════════════════════════════════════ */

describe("timeEntryStatusSchema", () => {
  it("accepts submit action", () => {
    const result = validateBody(timeEntryStatusSchema, { action: "submit" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid actions", () => {
    for (const action of [
      "submit",
      "approve",
      "reject",
      "correct",
      "confirm",
    ]) {
      const result = validateBody(timeEntryStatusSchema, { action });
      expect(result.success, `action ${action} should be valid`).toBe(true);
    }
  });

  it("rejects invalid action", () => {
    const result = validateBody(timeEntryStatusSchema, {
      action: "finalize",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional comment", () => {
    const result = validateBody(timeEntryStatusSchema, {
      action: "reject",
      comment: "Bitte Pausenzeit korrigieren",
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.comment).toBe("Bitte Pausenzeit korrigieren");
  });
});

/* ══════════════════════════════════════════════════════════════════
   updateAbsenceStatusSchema
   ══════════════════════════════════════════════════════════════════ */

describe("updateAbsenceStatusSchema", () => {
  it("accepts German status values", () => {
    for (const status of ["GENEHMIGT", "ABGELEHNT", "STORNIERT"]) {
      const result = validateBody(updateAbsenceStatusSchema, { status });
      expect(result.success, `status ${status} should be valid`).toBe(true);
    }
  });

  it("rejects English status values", () => {
    const result = validateBody(updateAbsenceStatusSchema, {
      status: "APPROVED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects AUSSTEHEND (pending — not a valid transition target)", () => {
    const result = validateBody(updateAbsenceStatusSchema, {
      status: "AUSSTEHEND",
    });
    expect(result.success).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   XSS Sanitization via validateBody
   ══════════════════════════════════════════════════════════════════ */

describe("validateBody XSS sanitization", () => {
  it("strips <script> tags from string fields", () => {
    const result = validateBody(createEmployeeSchema, {
      firstName: '<script>alert("xss")</script>Max',
      lastName: "Mustermann",
      email: "max@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).not.toContain("<script>");
      expect(result.data.firstName).toContain("Max");
    }
  });

  it("strips event handlers from string fields", () => {
    const result = validateBody(createEmployeeSchema, {
      firstName: 'Max" onmouseover="alert(1)',
      lastName: "Mustermann",
      email: "max@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).not.toContain("onmouseover");
    }
  });

  it("strips javascript: protocol from strings", () => {
    const result = validateBody(createEmployeeSchema, {
      firstName: "Max",
      lastName: "Mustermann",
      email: "javascript:alert(1)@example.com",
    });
    // Either fails validation (invalid email) or sanitizes
    if (result.success) {
      expect(result.data.email).not.toContain("javascript:");
    }
  });

  it("preserves safe text content", () => {
    const result = validateBody(createEmployeeSchema, {
      firstName: "Müller-Lüdenscheid",
      lastName: "O'Connor",
      email: "muller@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Müller-Lüdenscheid");
      expect(result.data.lastName).toBe("O'Connor");
    }
  });

  it("returns structured error response on validation failure", () => {
    const result = validateBody(createEmployeeSchema, {
      firstName: "", // required
      lastName: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });

  it("rejects employee creation without email", () => {
    const result = validateBody(createEmployeeSchema, {
      firstName: "Max",
      lastName: "Mustermann",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });
});
