-- Campus scope for accounting transactions (CoA stays school-wide)
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "bank_transactions" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- Backfill existing rows to each school's main (or first) campus
UPDATE "journal_entries" je
SET "branchId" = (
  SELECT b.id FROM "branches" b
  WHERE b."schoolId" = je."schoolId"
  ORDER BY b."isMain" DESC, b."createdAt" ASC
  LIMIT 1
)
WHERE je."branchId" IS NULL;

UPDATE "vouchers" v
SET "branchId" = (
  SELECT b.id FROM "branches" b
  WHERE b."schoolId" = v."schoolId"
  ORDER BY b."isMain" DESC, b."createdAt" ASC
  LIMIT 1
)
WHERE v."branchId" IS NULL;

UPDATE "budgets" x
SET "branchId" = (
  SELECT b.id FROM "branches" b
  WHERE b."schoolId" = x."schoolId"
  ORDER BY b."isMain" DESC, b."createdAt" ASC
  LIMIT 1
)
WHERE x."branchId" IS NULL;

UPDATE "bank_accounts" ba
SET "branchId" = (
  SELECT b.id FROM "branches" b
  WHERE b."schoolId" = ba."schoolId"
  ORDER BY b."isMain" DESC, b."createdAt" ASC
  LIMIT 1
)
WHERE ba."branchId" IS NULL;

UPDATE "bank_transactions" bt
SET "branchId" = (
  SELECT b.id FROM "branches" b
  WHERE b."schoolId" = bt."schoolId"
  ORDER BY b."isMain" DESC, b."createdAt" ASC
  LIMIT 1
)
WHERE bt."branchId" IS NULL;

UPDATE "invoices" i
SET "branchId" = (
  SELECT b.id FROM "branches" b
  WHERE b."schoolId" = i."schoolId"
  ORDER BY b."isMain" DESC, b."createdAt" ASC
  LIMIT 1
)
WHERE i."branchId" IS NULL;

CREATE INDEX IF NOT EXISTS "journal_entries_schoolId_branchId_idx" ON "journal_entries"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "vouchers_schoolId_branchId_idx" ON "vouchers"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "budgets_schoolId_branchId_idx" ON "budgets"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "bank_accounts_schoolId_branchId_idx" ON "bank_accounts"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "bank_transactions_schoolId_branchId_idx" ON "bank_transactions"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "invoices_schoolId_branchId_idx" ON "invoices"("schoolId", "branchId");
