-- CreateEnum
CREATE TYPE "ComplianceRule" AS ENUM ('ARBZG_3', 'ARBZG_4', 'ARBZG_5', 'SACHKUNDE_34A', 'GEOFENCE');

-- CreateEnum
CREATE TYPE "BewacherRegisterStatus" AS ENUM ('ANGEMELDET', 'GEPRUEFT', 'ABGELEHNT', 'ABGEMELDET');

-- CreateEnum
CREATE TYPE "GeofenceStatus" AS ENUM ('INSIDE', 'OUTSIDE', 'OVERRIDDEN', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bewacherId" TEXT,
ADD COLUMN     "bewacherRegisterStatus" "BewacherRegisterStatus",
ADD COLUMN     "bewacherValidatedAt" TIMESTAMP(3),
ADD COLUMN     "reliabilityCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "geocodedAt" TIMESTAMP(3),
ADD COLUMN     "geofenceEnforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "checkInAccuracyM" DOUBLE PRECISION,
ADD COLUMN     "checkInDistanceM" DOUBLE PRECISION,
ADD COLUMN     "checkInLatitude" DOUBLE PRECISION,
ADD COLUMN     "checkInLongitude" DOUBLE PRECISION,
ADD COLUMN     "checkOutDistanceM" DOUBLE PRECISION,
ADD COLUMN     "checkOutLatitude" DOUBLE PRECISION,
ADD COLUMN     "checkOutLongitude" DOUBLE PRECISION,
ADD COLUMN     "geofenceOverrideBy" TEXT,
ADD COLUMN     "geofenceOverrideReason" TEXT,
ADD COLUMN     "geofenceStatus" "GeofenceStatus",
ADD COLUMN     "locationMocked" BOOLEAN NOT NULL DEFAULT false;

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

-- CreateIndex
CREATE INDEX "ComplianceOverride_workspaceId_overriddenAt_idx" ON "ComplianceOverride"("workspaceId", "overriddenAt");

-- CreateIndex
CREATE INDEX "ComplianceOverride_entityType_entityId_idx" ON "ComplianceOverride"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ComplianceOverride_workspaceId_rule_idx" ON "ComplianceOverride"("workspaceId", "rule");

-- AddForeignKey
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
