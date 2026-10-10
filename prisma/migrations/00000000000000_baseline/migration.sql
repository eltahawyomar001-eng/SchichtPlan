-- Baseline: the complete schema as currently deployed.
--
-- Why this exists. The project was built with `prisma db push`, which never
-- writes to prisma/migrations, so the committed migrations only ever recorded
-- later deltas. There was no migration that creates "User", yet the earliest
-- one altered it -- so `prisma migrate deploy` against an empty database
-- failed on the first file with `relation "User" does not exist`, and the
-- Dockerfile's `migrate deploy` would have failed on any fresh deploy.
--
-- Generated with `prisma migrate diff --from-empty --to-schema`, so it matches
-- the schema exactly rather than being hand-assembled from the deltas.
--
-- The previous partial migrations are preserved in prisma/migrations-archive/
-- rather than deleted. They are not a valid chain and cannot be replayed on an
-- empty database, but they are the record of what was changed and when.
--
-- Existing databases must be marked as already having this:
--   npx prisma migrate resolve --applied 00000000000000_baseline
-- Running it against a populated database would otherwise try to create tables
-- that are already there.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SvSubmissionType" AS ENUM ('EAU', 'SOFORTMELDUNG');

-- CreateEnum
CREATE TYPE "SvSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'ERROR', 'NOT_INSURED');

-- CreateEnum
CREATE TYPE "ComplianceRule" AS ENUM ('ARBZG_3', 'ARBZG_4', 'ARBZG_5', 'SACHKUNDE_34A', 'GEOFENCE');

-- CreateEnum
CREATE TYPE "ShiftPlanApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('VOLLZEIT', 'TEILZEIT', 'MINIJOB', 'MIDIJOB');

-- CreateEnum
CREATE TYPE "TicketingAddonTier" AS ENUM ('NONE', 'STARTER', 'GROWTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BewacherRegisterStatus" AS ENUM ('ANGEMELDET', 'GEPRUEFT', 'ABGELEHNT', 'ABGEMELDET');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'OPEN');

-- CreateEnum
CREATE TYPE "GeofenceStatus" AS ENUM ('INSIDE', 'OUTSIDE', 'OVERRIDDEN', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('ENTWURF', 'EINGEREICHT', 'KORREKTUR', 'ZURUECKGEWIESEN', 'GEPRUEFT', 'BESTAETIGT');

-- CreateEnum
CREATE TYPE "AbsenceRequestStatus" AS ENUM ('AUSSTEHEND', 'GENEHMIGT', 'ABGELEHNT', 'STORNIERT');

-- CreateEnum
CREATE TYPE "AbsenceCategory" AS ENUM ('URLAUB', 'KRANK', 'ELTERNZEIT', 'SONDERURLAUB', 'UNBEZAHLT', 'FORTBILDUNG', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "EauStatus" AS ENUM ('PENDING', 'RETRIEVED', 'NOT_FOUND', 'ERROR', 'MANUAL');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('VERFUEGBAR', 'BEVORZUGT', 'NICHT_VERFUEGBAR');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('AUSSTEHEND', 'GENEHMIGT', 'ABGELEHNT', 'STORNIERT');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('ANGEFRAGT', 'ANGENOMMEN', 'GENEHMIGT', 'ABGELEHNT', 'STORNIERT', 'ABGESCHLOSSEN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('AKTIV', 'PAUSIERT', 'ABGESCHLOSSEN', 'ARCHIVIERT');

-- CreateEnum
CREATE TYPE "MonthCloseStatus" AS ENUM ('OPEN', 'LOCKED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "WebhookFailureStatus" AS ENUM ('PENDING', 'RETRYING', 'FAILED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ARCHIVE', 'LOGIN');

-- CreateEnum
CREATE TYPE "AutoScheduleStatus" AS ENUM ('PREVIEW', 'APPLIED', 'PARTIALLY_APPLIED', 'DISCARDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutoFillStatus" AS ENUM ('PENDING', 'ASSIGNED', 'FAILED', 'DECLINED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('URGENT', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('GEPLANT', 'EINGECHECKT', 'ABGESCHLOSSEN', 'STORNIERT');

-- CreateEnum
CREATE TYPE "ServiceReportStatus" AS ENUM ('ENTWURF', 'ERSTELLT', 'VERSENDET');

-- CreateEnum
CREATE TYPE "VisitAuditEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'SIGNATURE_CAPTURED', 'VISIT_CREATED', 'VISIT_CANCELLED', 'OFFLINE_SYNC');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('SCHICHTPLAN', 'ZEITERFASSUNG', 'LOHNABRECHNUNG', 'TECHNIK', 'HR', 'QUALITAETSMANGEL', 'FEHLENDE_LEISTUNG', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('NIEDRIG', 'MITTEL', 'HOCH', 'DRINGEND');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OFFEN', 'IN_BEARBEITUNG', 'GESCHLOSSEN');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('INTERN', 'EXTERN');

-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('ERSTELLT', 'ANGESEHEN', 'STATUS_GEAENDERT', 'ZUGEWIESEN', 'KOMMENTAR', 'GESCHLOSSEN', 'ANGEHANGT', 'GELOESCHT', 'WIEDERHERGESTELLT');

-- CreateEnum
CREATE TYPE "InvoiceSequenceKind" AS ENUM ('SHIFTFY_BILLING', 'CUSTOMER_INVOICE');

-- CreateEnum
CREATE TYPE "SosStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SosResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SosEventType" AS ENUM ('CREATED', 'RANKED', 'TIER_NOTIFIED', 'LINK_OPENED', 'ACCEPTED', 'DECLINED', 'ESCALATED', 'FILLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SosActorType" AS ENUM ('SYSTEM', 'USER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "TimesheetImportStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimesheetImportSource" AS ENUM ('ANTHROPIC', 'OPENAI', 'MOCK');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ENTWURF', 'GESENDET', 'ANGENOMMEN', 'ABGELEHNT', 'STORNIERT');

-- CreateEnum
CREATE TYPE "CustomerInvoiceStatus" AS ENUM ('ENTWURF', 'GESENDET', 'BEZAHLT', 'UEBERFAELLIG', 'STORNIERT');

-- CreateEnum
CREATE TYPE "RecurringInterval" AS ENUM ('KEINE', 'MONATLICH', 'QUARTALSWEISE', 'JAEHRLICH');

-- CreateEnum
CREATE TYPE "EInvoiceFormat" AS ENUM ('XRECHNUNG', 'ZUGFERD');

-- CreateEnum
CREATE TYPE "EInvoiceSyntax" AS ENUM ('CII', 'UBL');

-- CreateEnum
CREATE TYPE "IncomingInvoiceStatus" AS ENUM ('NEU', 'GEPRUEFT', 'BEZAHLT', 'ABGELEHNT');

-- CreateEnum
CREATE TYPE "UnplannedDecision" AS ENUM ('OFFEN', 'GENEHMIGT', 'ABGELEHNT');

-- CreateEnum
CREATE TYPE "BreakSource" AS ENUM ('MITARBEITER', 'KORREKTUR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerified" TIMESTAMP(3),
    "hashedPassword" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "consentGivenAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorRecoveryCodes" TEXT,
    "dashboardFavorites" TEXT NOT NULL DEFAULT '[]',
    "preferredLocale" TEXT NOT NULL DEFAULT 'de',
    "tosVersion" TEXT,
    "tosAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT,
    "customRoleId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "bundesland" TEXT,
    "defaultBreakMinutes" INTEGER NOT NULL DEFAULT 30,
    "minHourlyWageCents" INTEGER NOT NULL DEFAULT 1390,
    "betriebsnummer" TEXT,
    "securitySectorMode" BOOLEAN NOT NULL DEFAULT false,
    "logo" TEXT,
    "datevConsultantNumber" TEXT,
    "datevClientNumber" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DATEVToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DATEVToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatevOAuthState" (
    "state" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatevOAuthState_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "OutlookConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "microsoftEmail" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutlookConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutlookOAuthState" (
    "state" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutlookOAuthState_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "SvSubmission" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "SvSubmissionType" NOT NULL,
    "status" "SvSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "meldegrund" TEXT,
    "trackingId" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "auFrom" DATE,
    "auTo" DATE,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SvSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditDossier" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "readinessScore" INTEGER NOT NULL,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "warnCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceOverride" (
    "id" TEXT NOT NULL,
    "rule" "ComplianceRule" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenBy" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ComplianceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetriebsratMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isChair" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetriebsratMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftPlanApproval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "locationId" TEXT,
    "shiftCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ShiftPlanApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3) NOT NULL,
    "decisionNote" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftPlanApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "baseRole" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "ticketingTier" "TicketingAddonTier" NOT NULL DEFAULT 'NONE',
    "ticketingStripeSubscriptionItemId" TEXT,
    "schichtplanungAddonActive" BOOLEAN NOT NULL DEFAULT false,
    "schichtplanungStripeSubscriptionItemId" TEXT,
    "schichtplanungAddonBilling" TEXT,
    "timesheetScannerAddonActive" BOOLEAN NOT NULL DEFAULT false,
    "timesheetScannerStripeSubscriptionItemId" TEXT,
    "timesheetScannerAddonBilling" TEXT,
    "overLimitSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceCustomer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyName" TEXT,
    "vatId" TEXT,
    "billingEmail" TEXT,
    "billingAddress" TEXT,
    "billingCity" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT NOT NULL DEFAULT 'DE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "vatAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "pdfUrl" TEXT,
    "hostedUrl" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuerName" TEXT,
    "issuerVatId" TEXT,
    "issuerAddress" TEXT,
    "recipientName" TEXT,
    "recipientVatId" TEXT,
    "recipientAddress" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceUsage" (
    "id" TEXT NOT NULL,
    "userSlotsTotal" INTEGER NOT NULL DEFAULT 10,
    "pdfsGeneratedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "pdfsMonthlyLimit" INTEGER NOT NULL DEFAULT 50,
    "pdfsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageBytesUsed" BIGINT NOT NULL DEFAULT 0,
    "storageBytesLimit" BIGINT NOT NULL DEFAULT 524288000,
    "ticketsCreatedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "ticketsMonthlyLimit" INTEGER NOT NULL DEFAULT 0,
    "ticketStorageBytesUsed" BIGINT NOT NULL DEFAULT 0,
    "ticketStorageBytesLimit" BIGINT NOT NULL DEFAULT 0,
    "ticketsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scansThisMonth" INTEGER NOT NULL DEFAULT 0,
    "scansMonthlyLimit" INTEGER NOT NULL DEFAULT 30,
    "scansResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailsSentThisMonth" INTEGER NOT NULL DEFAULT 0,
    "emailsMonthlyLimit" INTEGER NOT NULL DEFAULT 100,
    "emailsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "WorkspaceUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "weeklyHours" DOUBLE PRECISION,
    "workDaysPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "contractType" "ContractType" NOT NULL DEFAULT 'VOLLZEIT',
    "flexibleWork" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "locationId" TEXT,
    "pinHash" TEXT,
    "pinEmailFailed" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" DATE,
    "socialSecurityNumber" TEXT,
    "birthPlace" TEXT,
    "nationality" TEXT,
    "employmentStartDate" DATE,
    "datevPersonnelNumber" TEXT,
    "bewacherId" TEXT,
    "bewacherRegisterStatus" "BewacherRegisterStatus",
    "bewacherValidatedAt" TIMESTAMP(3),
    "reliabilityCheckedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDepartment" (
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDepartment_pkey" PRIMARY KEY ("employeeId","departmentId")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "bundesland" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 600,
    "geofenceEnforced" BOOLEAN NOT NULL DEFAULT false,
    "geocodedAt" TIMESTAMP(3),
    "certificationExempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "locationId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationRequiredSkill" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationRequiredSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "id" TEXT NOT NULL,
    "expiresAt" DATE,
    "certificateNumber" TEXT,
    "issuingAuthority" TEXT,
    "issuedAt" DATE,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "notes" TEXT,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isNightShift" BOOLEAN NOT NULL DEFAULT false,
    "isHolidayShift" BOOLEAN NOT NULL DEFAULT false,
    "isSundayShift" BOOLEAN NOT NULL DEFAULT false,
    "surchargePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "locationId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bundesland" TEXT NOT NULL,
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationBalance" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalEntitlement" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "carryOver" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VacationBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakStartAt" TIMESTAMP(3),
    "breakEnd" TEXT,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "grossMinutes" INTEGER NOT NULL DEFAULT 0,
    "netMinutes" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'ENTWURF',
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "clockInAt" TIMESTAMP(3),
    "clockOutAt" TIMESTAMP(3),
    "isLiveClock" BOOLEAN NOT NULL DEFAULT false,
    "checkInLatitude" DOUBLE PRECISION,
    "checkInLongitude" DOUBLE PRECISION,
    "checkInAccuracyM" DOUBLE PRECISION,
    "checkInDistanceM" DOUBLE PRECISION,
    "checkOutLatitude" DOUBLE PRECISION,
    "checkOutLongitude" DOUBLE PRECISION,
    "checkOutDistanceM" DOUBLE PRECISION,
    "geofenceStatus" "GeofenceStatus",
    "locationMocked" BOOLEAN NOT NULL DEFAULT false,
    "geofenceOverrideBy" TEXT,
    "geofenceOverrideReason" TEXT,
    "unplannedDecision" "UnplannedDecision" NOT NULL DEFAULT 'OFFEN',
    "unplannedReason" TEXT,
    "unplannedDecidedBy" TEXT,
    "unplannedDecidedAt" TIMESTAMP(3),
    "latenessReason" TEXT,
    "latenessReasonAt" TIMESTAMP(3),
    "latenessReasonBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT,
    "shiftId" TEXT,
    "projectId" TEXT,
    "invoicedItemId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntryAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT,
    "comment" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeEntryId" TEXT NOT NULL,

    CONSTRAINT "TimeEntryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceRequest" (
    "id" TEXT NOT NULL,
    "category" "AbsenceCategory" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "halfDayStart" BOOLEAN NOT NULL DEFAULT false,
    "halfDayEnd" BOOLEAN NOT NULL DEFAULT false,
    "totalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AbsenceRequestStatus" NOT NULL DEFAULT 'AUSSTEHEND',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EauRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceRequestId" TEXT,
    "status" "EauStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "auFrom" DATE,
    "auTo" DATE,
    "isInitial" BOOLEAN,
    "issuedDate" DATE,
    "krankenkasse" TEXT,
    "reference" TEXT,
    "message" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EauRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "type" "AvailabilityType" NOT NULL DEFAULT 'VERFUEGBAR',
    "validFrom" DATE NOT NULL,
    "validUntil" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftChangeRequest" (
    "id" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'AUSSTEHEND',
    "reason" TEXT,
    "shiftId" TEXT NOT NULL,
    "newDate" DATE,
    "newStartTime" TEXT,
    "newEndTime" TEXT,
    "newNotes" TEXT,
    "requesterId" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ShiftChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSwapRequest" (
    "id" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'ANGEFRAGT',
    "reason" TEXT,
    "shiftId" TEXT NOT NULL,
    "targetShiftId" TEXT,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ShiftSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeAccount" (
    "id" TEXT NOT NULL,
    "contractHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "carryoverMinutes" INTEGER NOT NULL DEFAULT 0,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "TimeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'DE',
    "vatId" TEXT,
    "leitwegId" TEXT,
    "invoiceEmail" TEXT,
    "preferredFormat" "EInvoiceFormat",
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'AKTIV',
    "costRate" DOUBLE PRECISION,
    "billRate" DOUBLE PRECISION,
    "budgetMinutes" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "clientId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthClose" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "MonthCloseStatus" NOT NULL DEFAULT 'OPEN',
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "MonthClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "monthCloseId" TEXT,
    "projectId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookFailure" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" "WebhookFailureStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endpointId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "WebhookFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESignature" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "signedBy" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "statement" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ESignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "changes" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffingRequirement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "minEmployees" INTEGER NOT NULL DEFAULT 1,
    "maxEmployees" INTEGER,
    "requiredSkillId" TEXT,
    "locationId" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATE,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "StaffingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoScheduleRun" (
    "id" TEXT NOT NULL,
    "status" "AutoScheduleStatus" NOT NULL DEFAULT 'PREVIEW',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "locationId" TEXT,
    "totalOpenShifts" INTEGER NOT NULL DEFAULT 0,
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostEstimate" DOUBLE PRECISION,
    "fairnessScore" DOUBLE PRECISION,
    "assignments" JSONB NOT NULL DEFAULT '[]',
    "unresolvedShifts" JSONB NOT NULL DEFAULT '[]',
    "configSnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AutoScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFillLog" (
    "id" TEXT NOT NULL,
    "status" "AutoFillStatus" NOT NULL DEFAULT 'PENDING',
    "shiftId" TEXT NOT NULL,
    "vacatedByEmployeeId" TEXT,
    "assignedToEmployeeId" TEXT,
    "reason" TEXT NOT NULL,
    "complianceChecks" JSONB NOT NULL DEFAULT '[]',
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "candidatesEvaluated" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "AutoFillLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "link" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ManagerAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'GEPLANT',
    "scheduledDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reportId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitSignature" (
    "id" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitId" TEXT NOT NULL,

    CONSTRAINT "VisitSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ServiceReportStatus" NOT NULL DEFAULT 'ENTWURF',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "completedVisits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ServiceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisitAuditLog" (
    "id" TEXT NOT NULL,
    "eventType" "VisitAuditEventType" NOT NULL,
    "serverTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientTimestamp" TIMESTAMP(3),
    "deviceId" TEXT,
    "userAgent" TEXT,
    "signatureData" TEXT,
    "checksum" TEXT NOT NULL,
    "metadata" TEXT,
    "offlineSync" BOOLEAN NOT NULL DEFAULT false,
    "visitId" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ServiceVisitAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ICalToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" VARCHAR(100),
    "lastUsedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ICalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "ticketType" "TicketType" NOT NULL DEFAULT 'INTERN',
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "categoryDefId" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MITTEL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OFFEN',
    "location" VARCHAR(200),
    "objectAddress" VARCHAR(300),
    "externalSubmitterName" VARCHAR(200),
    "externalToken" TEXT,
    "createdById" TEXT,
    "assignedToId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "firstViewedAt" TIMESTAMP(3),
    "firstViewedById" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" VARCHAR(64),

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategoryDef" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "color" VARCHAR(20),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyEnum" "TicketCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategoryDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventType" "TicketEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" VARCHAR(200),
    "oldValue" VARCHAR(500),
    "newValue" VARCHAR(500),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "commentId" TEXT,
    "fileName" VARCHAR(500) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" VARCHAR(150) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "uploadedById" TEXT,
    "uploaderName" VARCHAR(200),
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "workspaceId" TEXT NOT NULL,
    "kind" "InvoiceSequenceKind" NOT NULL DEFAULT 'SHIFTFY_BILLING',
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("workspaceId","kind")
);

-- CreateTable
CREATE TABLE "StationSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionKeyHash" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL DEFAULT 'Unbekanntes Gerät',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vatId" TEXT,
    "address" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssuerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "createdById" TEXT,
    "bonusAmount" DECIMAL(10,2),
    "bonusCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "bonusNote" TEXT,
    "status" "SosStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "filledById" TEXT,
    "filledAt" TIMESTAMP(3),
    "escalationTier" INTEGER NOT NULL DEFAULT 1,
    "nextEscalationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SosRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosNotification" (
    "id" TEXT NOT NULL,
    "sosRequestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" "SosResponse" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "responseToken" TEXT NOT NULL,
    "linkOpenedAt" TIMESTAMP(3),

    CONSTRAINT "SosNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosEvent" (
    "id" TEXT NOT NULL,
    "sosRequestId" TEXT NOT NULL,
    "type" "SosEventType" NOT NULL,
    "actorType" "SosActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SosEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'de',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledFor" TEXT NOT NULL DEFAULT '[]',
    "disabledFor" TEXT NOT NULL DEFAULT '[]',
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TimesheetImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "TimesheetImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "source" "TimesheetImportSource" NOT NULL,
    "documentRef" TEXT NOT NULL,
    "missingEmployees" TEXT NOT NULL DEFAULT '[]',
    "importedByUserId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetImportEntry" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "extractedName" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "confidenceScores" TEXT NOT NULL DEFAULT '{}',
    "status" "TimesheetImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "materializedShiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetImportEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "number" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT,
    "notes" TEXT,
    "issueDate" DATE NOT NULL,
    "validUntil" DATE,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "acceptToken" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "convertedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "quoteId" TEXT,
    "number" TEXT,
    "status" "CustomerInvoiceStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT,
    "notes" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recurring" "RecurringInterval" NOT NULL DEFAULT 'KEINE',
    "recurringNextRun" DATE,
    "recurringActive" BOOLEAN NOT NULL DEFAULT false,
    "recurringParentId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "einvoiceXml" TEXT,
    "einvoiceFormat" "EInvoiceFormat",
    "einvoiceSha256" TEXT,
    "correctsInvoiceId" TEXT,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "vatRate" DOUBLE PRECISION,
    "unitCode" TEXT NOT NULL DEFAULT 'C62',

    CONSTRAINT "CustomerInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkProofPhoto" (
    "id" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" VARCHAR(500) NOT NULL,
    "fileType" VARCHAR(150) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION,
    "geofenceStatus" "GeofenceStatus",
    "locationMocked" BOOLEAN NOT NULL DEFAULT false,
    "address" VARCHAR(300),
    "note" VARCHAR(500),
    "timeEntryId" TEXT,
    "shiftId" TEXT,
    "locationId" TEXT,
    "employeeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkProofPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveActivityToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "labels" JSONB,
    "companyName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveActivityToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "locale" TEXT NOT NULL DEFAULT 'de',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceIssuerProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "street" TEXT NOT NULL,
    "addressLine2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'DE',
    "vatId" TEXT,
    "taxNumber" TEXT,
    "legalRegistrationId" TEXT,
    "kleinunternehmer" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "phone" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "bankName" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "numberPrefix" TEXT NOT NULL DEFAULT 'RE',
    "paymentTermDays" INTEGER NOT NULL DEFAULT 14,
    "defaultFormat" "EInvoiceFormat" NOT NULL DEFAULT 'XRECHNUNG',
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceIssuerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingInvoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "xml" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileName" TEXT,
    "syntax" "EInvoiceSyntax" NOT NULL,
    "profile" TEXT,
    "number" TEXT,
    "typeCode" TEXT,
    "issueDate" DATE,
    "dueDate" DATE,
    "currency" TEXT,
    "sellerName" TEXT,
    "sellerVatId" TEXT,
    "buyerName" TEXT,
    "netCents" INTEGER,
    "taxCents" INTEGER,
    "grossCents" INTEGER,
    "precedingNumber" TEXT,
    "status" "IncomingInvoiceStatus" NOT NULL DEFAULT 'NEU',
    "notes" TEXT,
    "importedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "IncomingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntryBreak" (
    "id" TEXT NOT NULL,
    "startOffsetMinutes" INTEGER NOT NULL,
    "endOffsetMinutes" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "source" "BreakSource" NOT NULL DEFAULT 'MITARBEITER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "TimeEntryBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserTask_userId_idx" ON "UserTask"("userId");

-- CreateIndex
CREATE INDEX "UserTask_workspaceId_idx" ON "UserTask"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_idx" ON "Invitation"("workspaceId");

-- CreateIndex
CREATE INDEX "Invitation_email_workspaceId_idx" ON "Invitation"("email", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DATEVToken_workspaceId_key" ON "DATEVToken"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "OutlookConnection_userId_key" ON "OutlookConnection"("userId");

-- CreateIndex
CREATE INDEX "SvSubmission_workspaceId_type_idx" ON "SvSubmission"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "SvSubmission_employeeId_idx" ON "SvSubmission"("employeeId");

-- CreateIndex
CREATE INDEX "AuditDossier_workspaceId_generatedAt_idx" ON "AuditDossier"("workspaceId", "generatedAt");

-- CreateIndex
CREATE INDEX "ComplianceOverride_workspaceId_overriddenAt_idx" ON "ComplianceOverride"("workspaceId", "overriddenAt");

-- CreateIndex
CREATE INDEX "ComplianceOverride_entityType_entityId_idx" ON "ComplianceOverride"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ComplianceOverride_workspaceId_rule_idx" ON "ComplianceOverride"("workspaceId", "rule");

-- CreateIndex
CREATE UNIQUE INDEX "BetriebsratMember_userId_key" ON "BetriebsratMember"("userId");

-- CreateIndex
CREATE INDEX "BetriebsratMember_workspaceId_idx" ON "BetriebsratMember"("workspaceId");

-- CreateIndex
CREATE INDEX "ShiftPlanApproval_workspaceId_status_idx" ON "ShiftPlanApproval"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ShiftPlanApproval_workspaceId_periodStart_idx" ON "ShiftPlanApproval"("workspaceId", "periodStart");

-- CreateIndex
CREATE INDEX "CustomRole_workspaceId_idx" ON "CustomRole"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_workspaceId_name_key" ON "CustomRole"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Feedback_workspaceId_idx" ON "Feedback"("workspaceId");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCustomer_workspaceId_key" ON "WorkspaceCustomer"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_idx" ON "Invoice"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUsage_workspaceId_key" ON "WorkspaceUsage"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceUsage_workspaceId_idx" ON "WorkspaceUsage"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_locationId_idx" ON "Employee"("locationId");

-- CreateIndex
CREATE INDEX "Employee_workspaceId_idx" ON "Employee"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_workspaceId_key" ON "Employee"("email", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workspaceId_pinHash_key" ON "Employee"("workspaceId", "pinHash");

-- CreateIndex
CREATE INDEX "EmployeeDepartment_departmentId_idx" ON "EmployeeDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "Location_workspaceId_deletedAt_idx" ON "Location"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Department_workspaceId_idx" ON "Department"("workspaceId");

-- CreateIndex
CREATE INDEX "Department_workspaceId_deletedAt_idx" ON "Department"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Skill_workspaceId_idx" ON "Skill"("workspaceId");

-- CreateIndex
CREATE INDEX "Skill_workspaceId_deletedAt_idx" ON "Skill"("workspaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_workspaceId_key" ON "Skill"("name", "workspaceId");

-- CreateIndex
CREATE INDEX "LocationRequiredSkill_locationId_idx" ON "LocationRequiredSkill"("locationId");

-- CreateIndex
CREATE INDEX "LocationRequiredSkill_skillId_idx" ON "LocationRequiredSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationRequiredSkill_locationId_skillId_key" ON "LocationRequiredSkill"("locationId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSkill_employeeId_skillId_key" ON "EmployeeSkill"("employeeId", "skillId");

-- CreateIndex
CREATE INDEX "ShiftTemplate_workspaceId_idx" ON "ShiftTemplate"("workspaceId");

-- CreateIndex
CREATE INDEX "ShiftTemplate_workspaceId_deletedAt_idx" ON "ShiftTemplate"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Shift_workspaceId_date_idx" ON "Shift"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "Shift_employeeId_date_idx" ON "Shift"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Shift_workspaceId_employeeId_idx" ON "Shift"("workspaceId", "employeeId");

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");

-- CreateIndex
CREATE INDEX "PublicHoliday_bundesland_idx" ON "PublicHoliday"("bundesland");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_bundesland_key" ON "PublicHoliday"("date", "bundesland");

-- CreateIndex
CREATE INDEX "VacationBalance_workspaceId_idx" ON "VacationBalance"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "VacationBalance_employeeId_year_key" ON "VacationBalance"("employeeId", "year");

-- CreateIndex
CREATE INDEX "TimeEntry_workspaceId_date_idx" ON "TimeEntry"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_date_idx" ON "TimeEntry"("employeeId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_workspaceId_employeeId_idx" ON "TimeEntry"("workspaceId", "employeeId");

-- CreateIndex
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimeEntry_invoicedItemId_idx" ON "TimeEntry"("invoicedItemId");

-- CreateIndex
CREATE INDEX "TimeEntry_workspaceId_unplannedDecision_idx" ON "TimeEntry"("workspaceId", "unplannedDecision");

-- CreateIndex
CREATE INDEX "TimeEntryAudit_timeEntryId_idx" ON "TimeEntryAudit"("timeEntryId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");

-- CreateIndex
CREATE INDEX "AbsenceRequest_workspaceId_status_idx" ON "AbsenceRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AbsenceRequest_employeeId_startDate_idx" ON "AbsenceRequest"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "AbsenceRequest_workspaceId_employeeId_idx" ON "AbsenceRequest"("workspaceId", "employeeId");

-- CreateIndex
CREATE INDEX "AbsenceRequest_workspaceId_startDate_idx" ON "AbsenceRequest"("workspaceId", "startDate");

-- CreateIndex
CREATE INDEX "EauRequest_workspaceId_idx" ON "EauRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "EauRequest_employeeId_idx" ON "EauRequest"("employeeId");

-- CreateIndex
CREATE INDEX "EauRequest_absenceRequestId_idx" ON "EauRequest"("absenceRequestId");

-- CreateIndex
CREATE INDEX "Availability_workspaceId_employeeId_idx" ON "Availability"("workspaceId", "employeeId");

-- CreateIndex
CREATE INDEX "Availability_employeeId_weekday_idx" ON "Availability"("employeeId", "weekday");

-- CreateIndex
CREATE INDEX "ShiftChangeRequest_workspaceId_status_idx" ON "ShiftChangeRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ShiftChangeRequest_requesterId_idx" ON "ShiftChangeRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ShiftChangeRequest_shiftId_idx" ON "ShiftChangeRequest"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_workspaceId_status_idx" ON "ShiftSwapRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_workspaceId_createdAt_idx" ON "ShiftSwapRequest"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_requesterId_idx" ON "ShiftSwapRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_targetId_idx" ON "ShiftSwapRequest"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeAccount_employeeId_key" ON "TimeAccount"("employeeId");

-- CreateIndex
CREATE INDEX "TimeAccount_workspaceId_idx" ON "TimeAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_key" ON "NotificationPreference"("userId", "channel");

-- CreateIndex
CREATE INDEX "AutomationSetting_workspaceId_idx" ON "AutomationSetting"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSetting_workspaceId_key_key" ON "AutomationSetting"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");

-- CreateIndex
CREATE INDEX "Client_workspaceId_deletedAt_idx" ON "Client"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_deletedAt_idx" ON "Project"("workspaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_employeeId_projectId_key" ON "ProjectMember"("employeeId", "projectId");

-- CreateIndex
CREATE INDEX "MonthClose_workspaceId_idx" ON "MonthClose"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthClose_workspaceId_year_month_key" ON "MonthClose"("workspaceId", "year", "month");

-- CreateIndex
CREATE INDEX "ExportJob_workspaceId_idx" ON "ExportJob"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_workspaceId_idx" ON "WebhookEndpoint"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookFailure_workspaceId_status_idx" ON "WebhookFailure"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "WebhookFailure_createdAt_idx" ON "WebhookFailure"("createdAt");

-- CreateIndex
CREATE INDEX "AutomationRule_workspaceId_idx" ON "AutomationRule"("workspaceId");

-- CreateIndex
CREATE INDEX "ESignature_workspaceId_signedAt_idx" ON "ESignature"("workspaceId", "signedAt");

-- CreateIndex
CREATE INDEX "ESignature_entityType_entityId_idx" ON "ESignature"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ESignature_signedBy_idx" ON "ESignature"("signedBy");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "StaffingRequirement_workspaceId_idx" ON "StaffingRequirement"("workspaceId");

-- CreateIndex
CREATE INDEX "StaffingRequirement_locationId_idx" ON "StaffingRequirement"("locationId");

-- CreateIndex
CREATE INDEX "StaffingRequirement_weekday_idx" ON "StaffingRequirement"("weekday");

-- CreateIndex
CREATE INDEX "AutoScheduleRun_workspaceId_idx" ON "AutoScheduleRun"("workspaceId");

-- CreateIndex
CREATE INDEX "AutoScheduleRun_userId_idx" ON "AutoScheduleRun"("userId");

-- CreateIndex
CREATE INDEX "AutoScheduleRun_status_idx" ON "AutoScheduleRun"("status");

-- CreateIndex
CREATE INDEX "AutoScheduleRun_createdAt_idx" ON "AutoScheduleRun"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AutoFillLog_workspaceId_idx" ON "AutoFillLog"("workspaceId");

-- CreateIndex
CREATE INDEX "AutoFillLog_shiftId_idx" ON "AutoFillLog"("shiftId");

-- CreateIndex
CREATE INDEX "AutoFillLog_status_idx" ON "AutoFillLog"("status");

-- CreateIndex
CREATE INDEX "AutoFillLog_createdAt_idx" ON "AutoFillLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ManagerAlert_workspaceId_idx" ON "ManagerAlert"("workspaceId");

-- CreateIndex
CREATE INDEX "ManagerAlert_severity_idx" ON "ManagerAlert"("severity");

-- CreateIndex
CREATE INDEX "ManagerAlert_acknowledged_idx" ON "ManagerAlert"("acknowledged");

-- CreateIndex
CREATE INDEX "ManagerAlert_createdAt_idx" ON "ManagerAlert"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceVisit_workspaceId_scheduledDate_idx" ON "ServiceVisit"("workspaceId", "scheduledDate");

-- CreateIndex
CREATE INDEX "ServiceVisit_employeeId_scheduledDate_idx" ON "ServiceVisit"("employeeId", "scheduledDate");

-- CreateIndex
CREATE INDEX "ServiceVisit_locationId_idx" ON "ServiceVisit"("locationId");

-- CreateIndex
CREATE INDEX "ServiceVisit_status_idx" ON "ServiceVisit"("status");

-- CreateIndex
CREATE INDEX "ServiceVisit_reportId_idx" ON "ServiceVisit"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitSignature_visitId_key" ON "VisitSignature"("visitId");

-- CreateIndex
CREATE INDEX "VisitSignature_visitId_idx" ON "VisitSignature"("visitId");

-- CreateIndex
CREATE INDEX "ServiceReport_workspaceId_idx" ON "ServiceReport"("workspaceId");

-- CreateIndex
CREATE INDEX "ServiceReport_status_idx" ON "ServiceReport"("status");

-- CreateIndex
CREATE INDEX "ServiceReport_periodStart_periodEnd_idx" ON "ServiceReport"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ServiceVisitAuditLog_visitId_serverTimestamp_idx" ON "ServiceVisitAuditLog"("visitId", "serverTimestamp");

-- CreateIndex
CREATE INDEX "ServiceVisitAuditLog_workspaceId_serverTimestamp_idx" ON "ServiceVisitAuditLog"("workspaceId", "serverTimestamp");

-- CreateIndex
CREATE INDEX "ServiceVisitAuditLog_eventType_idx" ON "ServiceVisitAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "ServiceVisitAuditLog_offlineSync_idx" ON "ServiceVisitAuditLog"("offlineSync");

-- CreateIndex
CREATE UNIQUE INDEX "ICalToken_token_key" ON "ICalToken"("token");

-- CreateIndex
CREATE INDEX "ICalToken_userId_idx" ON "ICalToken"("userId");

-- CreateIndex
CREATE INDEX "ICalToken_token_idx" ON "ICalToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_externalToken_key" ON "Ticket"("externalToken");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_idx" ON "Ticket"("workspaceId");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_externalToken_idx" ON "Ticket"("externalToken");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_status_idx" ON "Ticket"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_deletedAt_idx" ON "Ticket"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Ticket_categoryDefId_idx" ON "Ticket"("categoryDefId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_workspaceId_ticketNumber_key" ON "Ticket"("workspaceId", "ticketNumber");

-- CreateIndex
CREATE INDEX "StripeEvent_processedAt_idx" ON "StripeEvent"("processedAt" DESC);

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");

-- CreateIndex
CREATE INDEX "TicketCategoryDef_workspaceId_isActive_sortOrder_idx" ON "TicketCategoryDef"("workspaceId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCategoryDef_workspaceId_slug_key" ON "TicketCategoryDef"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_authorId_idx" ON "TicketComment"("authorId");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_idx" ON "TicketEvent"("ticketId");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAttachment_commentId_idx" ON "TicketAttachment"("commentId");

-- CreateIndex
CREATE INDEX "TicketAttachment_workspaceId_idx" ON "TicketAttachment"("workspaceId");

-- CreateIndex
CREATE INDEX "TicketAttachment_uploadedById_idx" ON "TicketAttachment"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "StationSession_sessionKeyHash_key" ON "StationSession"("sessionKeyHash");

-- CreateIndex
CREATE INDEX "StationSession_workspaceId_idx" ON "StationSession"("workspaceId");

-- CreateIndex
CREATE INDEX "StationSession_sessionKeyHash_idx" ON "StationSession"("sessionKeyHash");

-- CreateIndex
CREATE INDEX "IssuerProfile_validFrom_idx" ON "IssuerProfile"("validFrom");

-- CreateIndex
CREATE INDEX "SosRequest_workspaceId_idx" ON "SosRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "SosRequest_shiftId_idx" ON "SosRequest"("shiftId");

-- CreateIndex
CREATE INDEX "SosRequest_status_idx" ON "SosRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SosNotification_responseToken_key" ON "SosNotification"("responseToken");

-- CreateIndex
CREATE INDEX "SosNotification_sosRequestId_idx" ON "SosNotification"("sosRequestId");

-- CreateIndex
CREATE INDEX "SosNotification_employeeId_idx" ON "SosNotification"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SosNotification_sosRequestId_employeeId_key" ON "SosNotification"("sosRequestId", "employeeId");

-- CreateIndex
CREATE INDEX "SosEvent_sosRequestId_createdAt_idx" ON "SosEvent"("sosRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailJob_status_attempts_idx" ON "EmailJob"("status", "attempts");

-- CreateIndex
CREATE INDEX "EmailJob_nextRetryAt_idx" ON "EmailJob"("nextRetryAt");

-- CreateIndex
CREATE INDEX "EmailJob_createdAt_idx" ON "EmailJob"("createdAt");

-- CreateIndex
CREATE INDEX "TimesheetImport_workspaceId_status_idx" ON "TimesheetImport"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "TimesheetImport_workspaceId_importedAt_idx" ON "TimesheetImport"("workspaceId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetImportEntry_materializedShiftId_key" ON "TimesheetImportEntry"("materializedShiftId");

-- CreateIndex
CREATE INDEX "TimesheetImportEntry_workspaceId_status_idx" ON "TimesheetImportEntry"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "TimesheetImportEntry_importId_idx" ON "TimesheetImportEntry"("importId");

-- CreateIndex
CREATE INDEX "TimesheetImportEntry_employeeId_idx" ON "TimesheetImportEntry"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_acceptToken_key" ON "Quote"("acceptToken");

-- CreateIndex
CREATE INDEX "Quote_workspaceId_status_idx" ON "Quote"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_workspaceId_number_key" ON "Quote"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_workspaceId_status_idx" ON "CustomerInvoice"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CustomerInvoice_workspaceId_dueDate_idx" ON "CustomerInvoice"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "CustomerInvoice_recurringActive_recurringNextRun_idx" ON "CustomerInvoice"("recurringActive", "recurringNextRun");

-- CreateIndex
CREATE INDEX "CustomerInvoice_clientId_idx" ON "CustomerInvoice"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_workspaceId_number_key" ON "CustomerInvoice"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "CustomerInvoiceItem_invoiceId_idx" ON "CustomerInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "WorkProofPhoto_workspaceId_capturedAt_idx" ON "WorkProofPhoto"("workspaceId", "capturedAt");

-- CreateIndex
CREATE INDEX "WorkProofPhoto_timeEntryId_idx" ON "WorkProofPhoto"("timeEntryId");

-- CreateIndex
CREATE INDEX "WorkProofPhoto_shiftId_idx" ON "WorkProofPhoto"("shiftId");

-- CreateIndex
CREATE INDEX "WorkProofPhoto_employeeId_idx" ON "WorkProofPhoto"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveActivityToken_token_key" ON "LiveActivityToken"("token");

-- CreateIndex
CREATE INDEX "LiveActivityToken_employeeId_idx" ON "LiveActivityToken"("employeeId");

-- CreateIndex
CREATE INDEX "LiveActivityToken_workspaceId_idx" ON "LiveActivityToken"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex
CREATE INDEX "DeviceToken_workspaceId_idx" ON "DeviceToken"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceIssuerProfile_workspaceId_key" ON "InvoiceIssuerProfile"("workspaceId");

-- CreateIndex
CREATE INDEX "IncomingInvoice_workspaceId_status_idx" ON "IncomingInvoice"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "IncomingInvoice_workspaceId_issueDate_idx" ON "IncomingInvoice"("workspaceId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingInvoice_workspaceId_sha256_key" ON "IncomingInvoice"("workspaceId", "sha256");

-- CreateIndex
CREATE INDEX "TimeEntryBreak_timeEntryId_idx" ON "TimeEntryBreak"("timeEntryId");

-- CreateIndex
CREATE INDEX "TimeEntryBreak_workspaceId_idx" ON "TimeEntryBreak"("workspaceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTask" ADD CONSTRAINT "UserTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTask" ADD CONSTRAINT "UserTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DATEVToken" ADD CONSTRAINT "DATEVToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutlookConnection" ADD CONSTRAINT "OutlookConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SvSubmission" ADD CONSTRAINT "SvSubmission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SvSubmission" ADD CONSTRAINT "SvSubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDossier" ADD CONSTRAINT "AuditDossier_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetriebsratMember" ADD CONSTRAINT "BetriebsratMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetriebsratMember" ADD CONSTRAINT "BetriebsratMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPlanApproval" ADD CONSTRAINT "ShiftPlanApproval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPlanApproval" ADD CONSTRAINT "ShiftPlanApproval_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPlanApproval" ADD CONSTRAINT "ShiftPlanApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceCustomer" ADD CONSTRAINT "WorkspaceCustomer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUsage" ADD CONSTRAINT "WorkspaceUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationRequiredSkill" ADD CONSTRAINT "LocationRequiredSkill_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationRequiredSkill" ADD CONSTRAINT "LocationRequiredSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationBalance" ADD CONSTRAINT "VacationBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationBalance" ADD CONSTRAINT "VacationBalance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_invoicedItemId_fkey" FOREIGN KEY ("invoicedItemId") REFERENCES "CustomerInvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryAudit" ADD CONSTRAINT "TimeEntryAudit_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EauRequest" ADD CONSTRAINT "EauRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EauRequest" ADD CONSTRAINT "EauRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EauRequest" ADD CONSTRAINT "EauRequest_absenceRequestId_fkey" FOREIGN KEY ("absenceRequestId") REFERENCES "AbsenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_targetShiftId_fkey" FOREIGN KEY ("targetShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeAccount" ADD CONSTRAINT "TimeAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeAccount" ADD CONSTRAINT "TimeAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthClose" ADD CONSTRAINT "MonthClose_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_monthCloseId_fkey" FOREIGN KEY ("monthCloseId") REFERENCES "MonthClose"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookFailure" ADD CONSTRAINT "WebhookFailure_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookFailure" ADD CONSTRAINT "WebhookFailure_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESignature" ADD CONSTRAINT "ESignature_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_requiredSkillId_fkey" FOREIGN KEY ("requiredSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoScheduleRun" ADD CONSTRAINT "AutoScheduleRun_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoScheduleRun" ADD CONSTRAINT "AutoScheduleRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoScheduleRun" ADD CONSTRAINT "AutoScheduleRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillLog" ADD CONSTRAINT "AutoFillLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillLog" ADD CONSTRAINT "AutoFillLog_vacatedByEmployeeId_fkey" FOREIGN KEY ("vacatedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillLog" ADD CONSTRAINT "AutoFillLog_assignedToEmployeeId_fkey" FOREIGN KEY ("assignedToEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFillLog" ADD CONSTRAINT "AutoFillLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAlert" ADD CONSTRAINT "ManagerAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ServiceReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSignature" ADD CONSTRAINT "VisitSignature_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReport" ADD CONSTRAINT "ServiceReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisitAuditLog" ADD CONSTRAINT "ServiceVisitAuditLog_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ICalToken" ADD CONSTRAINT "ICalToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryDefId_fkey" FOREIGN KEY ("categoryDefId") REFERENCES "TicketCategoryDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategoryDef" ADD CONSTRAINT "TicketCategoryDef_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TicketComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationSession" ADD CONSTRAINT "StationSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosRequest" ADD CONSTRAINT "SosRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosRequest" ADD CONSTRAINT "SosRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosRequest" ADD CONSTRAINT "SosRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosRequest" ADD CONSTRAINT "SosRequest_filledById_fkey" FOREIGN KEY ("filledById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosNotification" ADD CONSTRAINT "SosNotification_sosRequestId_fkey" FOREIGN KEY ("sosRequestId") REFERENCES "SosRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosNotification" ADD CONSTRAINT "SosNotification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosEvent" ADD CONSTRAINT "SosEvent_sosRequestId_fkey" FOREIGN KEY ("sosRequestId") REFERENCES "SosRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImport" ADD CONSTRAINT "TimesheetImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImport" ADD CONSTRAINT "TimesheetImport_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImport" ADD CONSTRAINT "TimesheetImport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TimesheetImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_correctsInvoiceId_fkey" FOREIGN KEY ("correctsInvoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceItem" ADD CONSTRAINT "CustomerInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkProofPhoto" ADD CONSTRAINT "WorkProofPhoto_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkProofPhoto" ADD CONSTRAINT "WorkProofPhoto_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkProofPhoto" ADD CONSTRAINT "WorkProofPhoto_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkProofPhoto" ADD CONSTRAINT "WorkProofPhoto_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkProofPhoto" ADD CONSTRAINT "WorkProofPhoto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveActivityToken" ADD CONSTRAINT "LiveActivityToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveActivityToken" ADD CONSTRAINT "LiveActivityToken_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIssuerProfile" ADD CONSTRAINT "InvoiceIssuerProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryBreak" ADD CONSTRAINT "TimeEntryBreak_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryBreak" ADD CONSTRAINT "TimeEntryBreak_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

