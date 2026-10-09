/**
 * What each role is allowed to see of an employee record.
 *
 * The Employee row carries regulated personal data: Sozialversicherungsnummer,
 * date and place of birth, nationality, DATEV personnel number, Bewacher-ID,
 * wage and contract terms. A colleague has no business reading any of it.
 *
 * This is an ALLOWLIST, deliberately. The previous version removed two fields
 * (`hourlyRate`, `contractType`) and returned everything else, so every field
 * added to the model since then has been shipping to every authenticated user
 * by default -- including the social security number. With a denylist the
 * failure mode of forgetting a field is disclosure; with an allowlist it is a
 * missing field somebody notices and adds. Only one of those is safe.
 *
 * DSGVO Art. 5(1)(c) is the reason, and it has to be enforced in the QUERY:
 * stripping fields after the fact still reads them, and stripping them in a
 * client's Zod schema does not help at all, because the data has already left
 * the server.
 */

/** Fields a colleague may see. Enough to recognise who is on shift. */
export const EMPLOYEE_DIRECTORY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  position: true,
  color: true,
  isActive: true,
  locationId: true,
} as const;

/**
 * Fields a manager, admin or owner may see.
 *
 * Personnel administration genuinely needs the regulated fields -- the HR
 * screen edits them -- so they are listed explicitly rather than by omission.
 * pinHash is absent from both projections: it is a credential, never returned
 * to any client, and `hasPin` is derived from it separately.
 */
export const EMPLOYEE_MANAGEMENT_SELECT = {
  ...EMPLOYEE_DIRECTORY_SELECT,
  email: true,
  phone: true,
  hourlyRate: true,
  weeklyHours: true,
  workDaysPerWeek: true,
  contractType: true,
  flexibleWork: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  workspaceId: true,
  // Regulated personnel data. Managers only.
  dateOfBirth: true,
  socialSecurityNumber: true,
  birthPlace: true,
  nationality: true,
  employmentStartDate: true,
  datevPersonnelNumber: true,
  bewacherId: true,
  bewacherRegisterStatus: true,
  bewacherValidatedAt: true,
  reliabilityCheckedAt: true,
  pinEmailFailed: true,
} as const;

/**
 * Fields that must never reach a colleague, asserted in tests.
 *
 * Kept as data so a test can check the actual HTTP response rather than
 * trusting that the select above was written correctly.
 */
export const EMPLOYEE_SENSITIVE_FIELDS = [
  "socialSecurityNumber",
  "dateOfBirth",
  "birthPlace",
  "nationality",
  "hourlyRate",
  "contractType",
  "datevPersonnelNumber",
  "bewacherId",
  "bewacherRegisterStatus",
  "pinHash",
  "email",
  "phone",
] as const;
