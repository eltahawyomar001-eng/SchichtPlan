-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "securitySectorMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "certificationExempt" BOOLEAN NOT NULL DEFAULT false;
