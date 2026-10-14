-- Snapshot selected cash/bank account on fee payment receipts
ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "cashBankAccountId" TEXT;
ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "cashBankAccountName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "cashBankAccountNumber" TEXT NOT NULL DEFAULT '';
