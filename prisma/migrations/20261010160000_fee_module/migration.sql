-- Fee particulars
CREATE TABLE "fee_particulars" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "particular" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'Monthly',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_particulars_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fee_particulars_schoolId_idx" ON "fee_particulars"("schoolId");
CREATE INDEX "fee_particulars_schoolId_status_idx" ON "fee_particulars"("schoolId", "status");
ALTER TABLE "fee_particulars" ADD CONSTRAINT "fee_particulars_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fee structures
CREATE TABLE "fee_structures" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "session" TEXT NOT NULL,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "particularId" TEXT,
    "particular" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'Monthly',
    "dueDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fee_structures_schoolId_idx" ON "fee_structures"("schoolId");
CREATE INDEX "fee_structures_schoolId_session_cls_section_idx" ON "fee_structures"("schoolId", "session", "cls", "section");
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Discount types
CREATE TABLE "discount_types" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discount_types_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "discount_types_schoolId_idx" ON "discount_types"("schoolId");
CREATE INDEX "discount_types_schoolId_status_idx" ON "discount_types"("schoolId", "status");
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fee invoices
CREATE TABLE "fee_invoices" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "invoiceNo" TEXT NOT NULL,
    "studentId" TEXT,
    "student" TEXT NOT NULL,
    "studentCode" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "due" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "discountTypeId" TEXT,
    "discountName" TEXT,
    "lines" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fee_invoices_schoolId_invoiceNo_key" ON "fee_invoices"("schoolId", "invoiceNo");
CREATE INDEX "fee_invoices_schoolId_idx" ON "fee_invoices"("schoolId");
CREATE INDEX "fee_invoices_schoolId_status_idx" ON "fee_invoices"("schoolId", "status");
CREATE INDEX "fee_invoices_schoolId_studentId_idx" ON "fee_invoices"("schoolId", "studentId");
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
