import { z } from "zod";
import { NextResponse } from "next/server";
import { sanitize } from "@/lib/sanitize";

/* ═══════════════════════════════════════════════════════════════
   Shared Zod schemas for API input validation
   ═══════════════════════════════════════════════════════════════ */

// ── Reusable field schemas ──────────────────────────────────────
const trimmedString = z.string().trim();
const requiredString = trimmedString.min(1, "Pflichtfeld");
const email = trimmedString.email("Ungültige E-Mail-Adresse");
const optionalEmail = trimmedString.email().optional().or(z.literal(""));
const optionalString = trimmedString.optional().or(z.literal(""));
const positiveNumber = z.coerce.number().nonnegative().optional();

const password = trimmedString
  .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
  .max(128, "Passwort darf maximal 128 Zeichen lang sein");

const timeString = trimmedString.regex(
  /^\d{2}:\d{2}$/,
  "Format muss HH:MM sein",
);

const dateString = trimmedString.min(1, "Datum ist erforderlich");

// ── Employee ────────────────────────────────────────────────────
const contractTypeEnum = z
  .enum(["VOLLZEIT", "TEILZEIT", "MINIJOB", "MIDIJOB"])
  .optional();

export const createEmployeeSchema = z.object({
  firstName: requiredString.max(100, "Maximal 100 Zeichen"),
  lastName: requiredString.max(100, "Maximal 100 Zeichen"),
  email: optionalEmail,
  phone: optionalString.pipe(z.string().max(30).optional()),
  position: optionalString.pipe(z.string().max(100).optional()),
  hourlyRate: positiveNumber,
  weeklyHours: positiveNumber,
  workDaysPerWeek: z
    .number()
    .min(1, "Min. 1 Tag/Woche")
    .max(7, "Max. 7 Tage/Woche")
    .optional(),
  contractType: contractTypeEnum,
  color: optionalString,
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  isActive: z.boolean().optional(),
  departmentId: z.string().optional().nullable(),
});

// ── Location ────────────────────────────────────────────────────
export const createLocationSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  address: optionalString.pipe(z.string().max(500).optional()),
});

// ── Shift ───────────────────────────────────────────────────────
export const createShiftSchema = z.object({
  date: dateString,
  startTime: timeString,
  endTime: timeString,
  employeeId: optionalString,
  locationId: optionalString,
  notes: optionalString.pipe(z.string().max(1000).optional()),
  repeatWeeks: z.coerce.number().int().min(0).max(52).optional(),
});

// ── Auto-Schedule ───────────────────────────────────────────────
export const autoScheduleSchema = z.object({
  startDate: dateString,
  endDate: dateString,
  locationId: optionalString,
  dryRun: z.boolean().optional().default(false),
  weights: z
    .object({
      fairness: z.number().min(0).max(100).optional(),
      preference: z.number().min(0).max(100).optional(),
      cost: z.number().min(0).max(100).optional(),
      continuity: z.number().min(0).max(100).optional(),
      staffing: z.number().min(0).max(100).optional(),
      fatigue: z.number().min(0).max(100).optional(),
      rotation: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

// ── Backfill (single-shift replacement) ─────────────────────────
export const backfillSchema = z.object({
  shiftId: requiredString,
  maxCandidates: z.coerce.number().int().min(1).max(20).optional().default(5),
});

// ── Staffing Requirement ────────────────────────────────────────
export const createStaffingRequirementSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: timeString,
  endTime: timeString,
  minEmployees: z.coerce.number().int().min(1).default(1),
  maxEmployees: z.coerce.number().int().min(1).optional().nullable(),
  requiredSkillId: optionalString,
  locationId: optionalString,
  departmentId: optionalString,
  isActive: z.boolean().optional().default(true),
  validFrom: optionalString,
  validUntil: optionalString,
});

export const updateStaffingRequirementSchema =
  createStaffingRequirementSchema.partial();

// ── Time Entry ──────────────────────────────────────────────────
export const createTimeEntrySchema = z.object({
  date: dateString,
  startTime: timeString,
  endTime: timeString,
  employeeId: requiredString,
  locationId: optionalString,
  shiftId: optionalString,
  projectId: optionalString,
  breakStart: optionalString,
  breakEnd: optionalString,
  remarks: optionalString.pipe(z.string().max(2000).optional()),
});

// ── Auth: Register ──────────────────────────────────────────────
export const registerSchema = z.object({
  name: requiredString.max(100, "Name darf maximal 100 Zeichen lang sein"),
  email: email,
  password: password,
  workspaceName: optionalString.pipe(z.string().max(200).optional()),
  invitationToken: optionalString,
  consentGiven: z.literal(true, {
    message: "Zustimmung zur Datenschutzerklärung ist erforderlich",
  }),
});

// ── Auth: Reset Password ────────────────────────────────────────
export const resetPasswordSchema = z.object({
  token: requiredString,
  password: password,
});

// ── Auth: Forgot Password ───────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: email,
});

// ── Invitation ──────────────────────────────────────────────────
export const createInvitationSchema = z.object({
  email: email,
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"]),
});

// ── Billing: Checkout ───────────────────────────────────────────
export const checkoutSchema = z.object({
  priceId: requiredString,
  quantity: z.coerce.number().int().min(1).max(10000).optional(),
});

// ── Profile: Change Password ────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: requiredString,
  newPassword: password,
});

// ── Webhook endpoint ────────────────────────────────────────────
export const createWebhookSchema = z.object({
  url: trimmedString.url("Ungültige URL"),
  events: z.array(z.string().min(1)).min(1, "Mindestens ein Event auswählen"),
});

// ── Service Visit (Leistungsnachweis) ───────────────────────────
export const createServiceVisitSchema = z.object({
  scheduledDate: dateString,
  employeeId: requiredString,
  locationId: requiredString,
  notes: optionalString.pipe(z.string().max(2000).optional()),
});

export const checkInVisitSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const checkOutVisitSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: optionalString.pipe(z.string().max(2000).optional()),
});

export const visitSignatureSchema = z.object({
  signatureData: requiredString, // Base64 PNG
  signerName: requiredString.max(200, "Maximal 200 Zeichen"),
  signerRole: optionalString.pipe(z.string().max(100).optional()),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const createServiceReportSchema = z.object({
  title: requiredString.max(300, "Maximal 300 Zeichen"),
  periodStart: dateString,
  periodEnd: dateString,
  locationId: optionalString, // filter visits by location
});

export const updateLocationGeoSchema = z.object({
  name: optionalString,
  address: optionalString,
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  geofenceRadius: z.coerce.number().int().min(50).max(5000).optional(),
});

/* ═══════════════════════════════════════════════════════════════
   Validation helper — parse & return typed 400 on failure
   ═══════════════════════════════════════════════════════════════ */

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; response: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Recursively sanitize all string values in a data structure.
 * Prevents XSS/HTML injection at the validation layer.
 */
function deepSanitize(value: unknown): unknown {
  if (typeof value === "string") return sanitize(value);
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepSanitize(val);
    }
    return result;
  }
  return value;
}

/**
 * Validate request body against a Zod schema.
 * Automatically sanitizes all string fields in the input before validation
 * to prevent XSS and HTML injection attacks.
 * Returns `{ success: true, data }` or `{ success: false, response }`
 * where `response` is a 400 NextResponse with structured errors.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): ValidationResult<T> {
  // Sanitize all string fields recursively before validation
  const sanitized = deepSanitize(body);
  const result = schema.safeParse(sanitized);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return {
      success: false,
      response: NextResponse.json(
        { error: "Ungültige Eingabe", details: errors },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: result.data };
}
