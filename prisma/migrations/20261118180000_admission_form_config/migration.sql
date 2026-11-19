-- Per-school admission form variant + student extras for institute-specific applications.
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "admissionFormConfig" JSONB;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "admissionExtras" JSONB;
