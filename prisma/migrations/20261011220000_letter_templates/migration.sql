-- AlterTable
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "admissionLetterTemplate" JSONB;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "jobLetterTemplate" JSONB;
