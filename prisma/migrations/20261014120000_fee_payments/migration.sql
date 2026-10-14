-- Fee payments (immutable receipt snapshots) + reprint audit
-- Safe additive migration: does not drop or modify existing payment data.

ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "session" TEXT;

CREATE TABLE IF NOT EXISTS "fee_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "receiptNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "studentCode" TEXT,
    "admissionNo" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "session" TEXT,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Cash',
    "reference" TEXT NOT NULL DEFAULT '',
    "cashierId" TEXT,
    "cashierName" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grossAmount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "previousBalance" INTEGER NOT NULL DEFAULT 0,
    "remainingBalance" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "linesSnapshot" JSONB,
    "schoolSnapshot" JSONB,
    "voucherId" TEXT,
    "voucherNo" TEXT,
    "journalEntryId" TEXT,
    "idempotencyKey" TEXT,
    "reprintCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_schoolId_receiptNo_key" ON "fee_payments"("schoolId", "receiptNo");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_schoolId_idempotencyKey_key" ON "fee_payments"("schoolId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "fee_payments_schoolId_idx" ON "fee_payments"("schoolId");
CREATE INDEX IF NOT EXISTS "fee_payments_schoolId_invoiceId_idx" ON "fee_payments"("schoolId", "invoiceId");
CREATE INDEX IF NOT EXISTS "fee_payments_schoolId_studentId_idx" ON "fee_payments"("schoolId", "studentId");
CREATE INDEX IF NOT EXISTS "fee_payments_schoolId_paidAt_idx" ON "fee_payments"("schoolId", "paidAt");
CREATE INDEX IF NOT EXISTS "fee_payments_schoolId_receiptNo_idx" ON "fee_payments"("schoolId", "receiptNo");

ALTER TABLE "fee_payments" DROP CONSTRAINT IF EXISTS "fee_payments_schoolId_fkey";
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_payments" DROP CONSTRAINT IF EXISTS "fee_payments_invoiceId_fkey";
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "fee_receipt_reprints" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_receipt_reprints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fee_receipt_reprints_schoolId_idx" ON "fee_receipt_reprints"("schoolId");
CREATE INDEX IF NOT EXISTS "fee_receipt_reprints_schoolId_paymentId_idx" ON "fee_receipt_reprints"("schoolId", "paymentId");
CREATE INDEX IF NOT EXISTS "fee_receipt_reprints_schoolId_createdAt_idx" ON "fee_receipt_reprints"("schoolId", "createdAt");

ALTER TABLE "fee_receipt_reprints" DROP CONSTRAINT IF EXISTS "fee_receipt_reprints_schoolId_fkey";
ALTER TABLE "fee_receipt_reprints" ADD CONSTRAINT "fee_receipt_reprints_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_receipt_reprints" DROP CONSTRAINT IF EXISTS "fee_receipt_reprints_paymentId_fkey";
ALTER TABLE "fee_receipt_reprints" ADD CONSTRAINT "fee_receipt_reprints_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
