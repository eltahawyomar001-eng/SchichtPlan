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
  workDaysPerWeek: z.coerce
    .number()
    .min(1, "Min. 1 Tag/Woche")
    .max(7, "Max. 7 Tage/Woche")
    .optional(),
  contractType: contractTypeEnum,
  color: optionalString,
  locationId: z.string().optional().nullable(),
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
  deviceId: optionalString,
  clientTimestamp: optionalString, // ISO-8601 from device clock
});

export const checkOutVisitSchema = z.object({
  notes: optionalString.pipe(z.string().max(2000).optional()),
  deviceId: optionalString,
  clientTimestamp: optionalString,
});

export const visitSignatureSchema = z.object({
  signatureData: requiredString, // Base64 PNG
  signerName: requiredString.max(200, "Maximal 200 Zeichen"),
  signerRole: optionalString.pipe(z.string().max(100).optional()),
  deviceId: optionalString,
  clientTimestamp: optionalString,
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
});

// ── Clock (time-entries/clock) ──────────────────────────────────
export const clockActionSchema = z.object({
  action: z.enum(["in", "out", "break-start", "break-end"], {
    message: "Ungültige Aktion",
  }),
  timezone: optionalString.pipe(z.string().max(100).optional()),
});

// ── Time Entry Status Update ────────────────────────────────────
export const timeEntryStatusSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "correct", "confirm"], {
    message: "Ungültige Aktion",
  }),
  comment: optionalString.pipe(z.string().max(2000).optional()),
});

// ── Update Time Entry (PATCH) ───────────────────────────────────
export const updateTimeEntrySchema = z.object({
  startTime: timeString.optional(),
  endTime: timeString.optional(),
  breakStart: optionalString,
  breakEnd: optionalString,
  breakMinutes: z.coerce.number().int().min(0).max(480).optional(),
  remarks: optionalString.pipe(z.string().max(2000).optional()),
  locationId: optionalString.nullable(),
  date: dateString.optional(),
});

// ── Absence (POST) ─────────────────────────────────────────────
export const createAbsenceSchema = z.object({
  employeeId: requiredString,
  category: z.enum(
    [
      "URLAUB",
      "KRANK",
      "UNBEZAHLT",
      "SONDERURLAUB",
      "ELTERNZEIT",
      "FORTBILDUNG",
      "SONSTIGES",
    ],
    { message: "Ungültige Abwesenheitskategorie" },
  ),
  startDate: dateString,
  endDate: dateString,
  halfDayStart: z.boolean().optional().default(false),
  halfDayEnd: z.boolean().optional().default(false),
});

// ── Absence Status Update (PATCH) ──────────────────────────────
export const updateAbsenceStatusSchema = z.object({
  status: z.enum(["GENEHMIGT", "ABGELEHNT", "STORNIERT"], {
    message: "Ungültiger Status",
  }),
  reviewNote: optionalString.pipe(z.string().max(2000).optional()),
});

// ── Month Close ─────────────────────────────────────────────────
export const monthCloseSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  action: z.enum(["lock", "unlock", "export"], {
    message: 'Ungültige Aktion. Erlaubt: "lock", "unlock", "export"',
  }),
});

// ── Shift Swap ──────────────────────────────────────────────────
export const createShiftSwapSchema = z.object({
  shiftId: requiredString,
  requesterId: requiredString,
  targetId: optionalString.nullable(),
  targetShiftId: optionalString.nullable(),
  reason: optionalString.pipe(z.string().max(1000).optional()),
});

// ── Availability ────────────────────────────────────────────────
const availabilityEntrySchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: optionalString,
  endTime: optionalString,
  type: z.enum(["VERFUEGBAR", "BEVORZUGT", "NICHT_VERFUEGBAR"]).optional(),
  notes: optionalString.pipe(z.string().max(500).optional()),
});

export const createAvailabilitySchema = z.object({
  employeeId: requiredString,
  entries: z.array(availabilityEntrySchema).min(1, "Mindestens ein Eintrag"),
  validFrom: optionalString,
});

// ── Department ──────────────────────────────────────────────────
export const createDepartmentSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  color: optionalString.pipe(z.string().max(50).optional()),
  locationId: optionalString.nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

// ── Skill ───────────────────────────────────────────────────────
export const createSkillSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  category: optionalString.pipe(z.string().max(200).optional()),
});

// ── Shift Template ──────────────────────────────────────────────
export const createShiftTemplateSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  startTime: timeString,
  endTime: timeString,
  color: optionalString.pipe(z.string().max(50).optional()),
  locationId: optionalString.nullable(),
});

export const updateShiftTemplateSchema = createShiftTemplateSchema.partial();

// ── Vacation Balance ────────────────────────────────────────────
export const createVacationBalanceSchema = z.object({
  employeeId: requiredString,
  year: z.coerce.number().int().min(2020).max(2100),
  totalEntitlement: z.coerce.number().nonnegative().optional(),
  carryOver: z.coerce.number().nonnegative().optional(),
});

// ── Project ─────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  name: requiredString.max(300, "Maximal 300 Zeichen"),
  description: optionalString.pipe(z.string().max(2000).optional()),
  clientId: optionalString.nullable(),
  costRate: z.coerce.number().nonnegative().optional().nullable(),
  billRate: z.coerce.number().nonnegative().optional().nullable(),
  budgetMinutes: z.coerce.number().int().nonnegative().optional().nullable(),
  startDate: optionalString.nullable(),
  endDate: optionalString.nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z
    .enum(["AKTIV", "PAUSIERT", "ABGESCHLOSSEN", "ARCHIVIERT"])
    .optional(),
});

// ── Project Member ──────────────────────────────────────────────
export const addProjectMemberSchema = z.object({
  employeeId: requiredString,
  role: z.enum(["MEMBER", "LEAD"]).optional().default("MEMBER"),
});

export const removeProjectMemberSchema = z.object({
  employeeId: requiredString,
});

// ── Client ──────────────────────────────────────────────────────
export const createClientSchema = z.object({
  name: requiredString.max(300, "Maximal 300 Zeichen"),
  email: optionalEmail.nullable(),
  phone: optionalString.pipe(z.string().max(50).optional()).nullable(),
  address: optionalString.pipe(z.string().max(500).optional()).nullable(),
  notes: optionalString.pipe(z.string().max(2000).optional()).nullable(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ── Chat Channel ────────────────────────────────────────────────
export const createChatChannelSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  description: optionalString.pipe(z.string().max(1000).optional()),
  type: z.enum(["GROUP", "DIRECT", "ANNOUNCEMENT"]).optional(),
  memberIds: z.array(z.string()).optional(),
  locationId: optionalString.nullable(),
  departmentId: optionalString.nullable(),
});

// ── Chat Message ────────────────────────────────────────────────
export const createChatMessageSchema = z.object({
  content: requiredString.max(5000, "Maximal 5000 Zeichen"),
  parentId: optionalString.nullable(),
});

// ── Chat Members (add) ──────────────────────────────────────────
export const addChatMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, "Mindestens ein Benutzer"),
});

// ── Push Subscription ───────────────────────────────────────────
export const createPushSubscriptionSchema = z.object({
  endpoint: requiredString.url("Ungültige Endpoint-URL"),
  keys: z.object({
    p256dh: requiredString,
    auth: requiredString,
  }),
});

export const deletePushSubscriptionSchema = z.object({
  endpoint: requiredString,
});

// ── Notification Preferences ────────────────────────────────────
export const updateNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
});

// ── Profile Update ──────────────────────────────────────────────
export const updateProfileSchema = z
  .object({
    name: optionalString.pipe(z.string().max(100).optional()),
    currentPassword: optionalString,
    newPassword: optionalString,
  })
  .refine(
    (data) => {
      // If either password field is provided, both must be
      if (data.currentPassword || data.newPassword) {
        return !!data.currentPassword && !!data.newPassword;
      }
      return true;
    },
    {
      message: "Beide Passwortfelder sind erforderlich",
      path: ["newPassword"],
    },
  );

// ── Shift Change Request ────────────────────────────────────────
export const createShiftChangeRequestSchema = z
  .object({
    shiftId: requiredString,
    newDate: optionalString,
    newStartTime: optionalString,
    newEndTime: optionalString,
    newNotes: optionalString.pipe(z.string().max(1000).optional()),
    reason: optionalString.pipe(z.string().max(2000).optional()),
  })
  .refine(
    (data) =>
      data.newDate ||
      data.newStartTime ||
      data.newEndTime ||
      data.newNotes !== undefined,
    {
      message:
        "Mindestens eine Änderung (Datum, Startzeit, Endzeit oder Notiz) ist erforderlich",
      path: ["shiftId"],
    },
  );

export const updateShiftChangeRequestSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"], {
    message: 'Ungültige Aktion. Erlaubt: "approve", "reject", "cancel"',
  }),
  reviewNote: optionalString.pipe(z.string().max(2000).optional()),
});

// ── Automation Rule ─────────────────────────────────────────────
export const createAutomationRuleSchema = z.object({
  name: requiredString.max(200, "Maximal 200 Zeichen"),
  description: optionalString.pipe(z.string().max(1000).optional()),
  trigger: requiredString.max(200, "Maximal 200 Zeichen"),
  conditions: z.unknown().optional(),
  actions: z.unknown(),
});

// ── Team: Update Role ───────────────────────────────────────────
export const updateTeamRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"], {
    message: "Ungültige Rolle",
  }),
});

// ── Team: Transfer Ownership ────────────────────────────────────
export const transferOwnershipSchema = z.object({
  targetUserId: requiredString,
});

// ── Workspace Update ────────────────────────────────────────────
const VALID_BUNDESLAENDER = [
  "BW",
  "BY",
  "BE",
  "BB",
  "HB",
  "HH",
  "HE",
  "MV",
  "NI",
  "NW",
  "RP",
  "SL",
  "SN",
  "ST",
  "SH",
  "TH",
] as const;

export const updateWorkspaceSchema = z
  .object({
    name: optionalString.pipe(z.string().max(200).optional()),
    industry: optionalString.pipe(z.string().max(200).optional()),
    bundesland: z
      .enum([...VALID_BUNDESLAENDER, ""])
      .optional()
      .nullable(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.industry !== undefined ||
      data.bundesland !== undefined,
    { message: "Keine Änderungen angegeben" },
  );

// ── Billing: Simulate ───────────────────────────────────────────
export const billingSimulateSchema = z.object({
  plan: z.enum(["basic", "professional", "enterprise"], {
    message: "Ungültiger Plan",
  }),
  billingCycle: z
    .enum(["monthly", "annual"], { message: "Ungültiger Abrechnungszyklus" })
    .optional()
    .default("monthly"),
});

// ── Export: DATEV Online ────────────────────────────────────────
export const datevExportSchema = z.object({
  start: dateString,
  end: dateString,
  employeeId: optionalString,
  monthCloseId: optionalString,
});

// ── iCal Token ──────────────────────────────────────────────────
export const createICalTokenSchema = z.object({
  label: optionalString.pipe(z.string().max(100).optional()),
});

// ── Auth: Pre-Login ─────────────────────────────────────────────
export const preLoginSchema = z.object({
  email: requiredString,
  password: requiredString,
});

// ── Auth: Verify Email ──────────────────────────────────────────
export const verifyEmailSchema = z.object({
  token: requiredString,
  email: email,
});

// ── Auth: Resend Verification ───────────────────────────────────
export const resendVerificationSchema = z.object({
  email: email,
});

// ── Auth: Two-Factor Code ───────────────────────────────────────
export const twoFactorVerifySchema = z.object({
  code: optionalString,
  token: optionalString,
});

// ── Admin: Workspace Wipe ───────────────────────────────────────
export const workspaceWipeSchema = z.object({
  confirm: requiredString,
});

// ── Employee Skill Assignment ───────────────────────────────────
export const assignEmployeeSkillSchema = z.object({
  skillId: requiredString,
  expiresAt: optionalString,
});

// ── Update Shift (PATCH) ────────────────────────────────────────
export const updateShiftSchema = z.object({
  date: optionalString,
  startTime: optionalString,
  endTime: optionalString,
  employeeId: optionalString.nullable(),
  locationId: optionalString.nullable(),
  notes: optionalString.pipe(z.string().max(1000).optional()),
  status: z.enum(["SCHEDULED", "OPEN", "COMPLETED", "CANCELLED"]).optional(),
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

// ─── Ticket Schemas ───────────────────────────────────────────

export const TICKET_CATEGORIES = [
  "SCHICHTPLAN",
  "ZEITERFASSUNG",
  "LOHNABRECHNUNG",
  "TECHNIK",
  "HR",
  "SONSTIGES",
] as const;

export const TICKET_PRIORITIES = [
  "NIEDRIG",
  "MITTEL",
  "HOCH",
  "DRINGEND",
] as const;

export const TICKET_STATUSES = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "GESCHLOSSEN",
] as const;

/**
 * Zero-tolerance: Reject submissions containing sensitive medical/health
 * data or GPS coordinates. This runs on subject + description fields.
 */
const SENSITIVE_DATA_PATTERNS = [
  // Health / medical data
  /krankmeldung|krankschreibung|attest|arzt(?:besuch|brief)|diagnose|medikament|gesundheit(?:sdaten)?|krankheit|befund|arbeitsunfähigkeit/i,
  // GPS / location tracking coordinates
  /\b\d{1,3}\.\d{4,},?\s*-?\d{1,3}\.\d{4,}\b/, // lat,lng pattern
  /\bgps[:\-_]?\s*\d/i,
  /\bcoordinat/i,
  /\bgeolocation/i,
];

function rejectSensitiveData(value: string, ctx: z.RefinementCtx): void {
  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Sensible Gesundheits- oder Standortdaten dürfen nicht übermittelt werden. Bitte entfernen Sie diese Angaben.",
      });
      return;
    }
  }
}

const ticketSubject = trimmedString
  .min(3, "Betreff muss mindestens 3 Zeichen lang sein")
  .max(200, "Betreff darf maximal 200 Zeichen lang sein")
  .superRefine(rejectSensitiveData);

const ticketDescription = trimmedString
  .min(10, "Beschreibung muss mindestens 10 Zeichen lang sein")
  .max(5000, "Beschreibung darf maximal 5000 Zeichen lang sein")
  .superRefine(rejectSensitiveData);

const ticketLocation = trimmedString
  .max(200, "Standort darf maximal 200 Zeichen lang sein")
  .optional()
  .or(z.literal(""));

export const createTicketSchema = z.object({
  subject: ticketSubject,
  description: ticketDescription,
  category: z.enum(TICKET_CATEGORIES, {
    message: "Ungültige Kategorie",
  }),
  priority: z
    .enum(TICKET_PRIORITIES, {
      message: "Ungültige Priorität",
    })
    .optional(),
  location: ticketLocation,
});

export const updateTicketSchema = z.object({
  subject: ticketSubject.optional(),
  description: ticketDescription.optional(),
  category: z
    .enum(TICKET_CATEGORIES, {
      message: "Ungültige Kategorie",
    })
    .optional(),
  priority: z
    .enum(TICKET_PRIORITIES, {
      message: "Ungültige Priorität",
    })
    .optional(),
  status: z
    .enum(TICKET_STATUSES, {
      message: "Ungültiger Status",
    })
    .optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  location: ticketLocation,
});

/** Schema for the public external ticket form (no login required). */
export const createExternalTicketSchema = z.object({
  name: trimmedString
    .min(2, "Name muss mindestens 2 Zeichen lang sein")
    .max(200, "Name darf maximal 200 Zeichen lang sein"),
  subject: ticketSubject,
  description: ticketDescription,
  location: ticketLocation,
  category: z.enum(TICKET_CATEGORIES, {
    message: "Ungültige Kategorie",
  }),
});

export const createTicketCommentSchema = z.object({
  content: trimmedString
    .min(1, "Kommentar darf nicht leer sein")
    .max(5000, "Kommentar darf maximal 5000 Zeichen lang sein")
    .superRefine(rejectSensitiveData),
  isInternal: z.boolean().optional(),
});
