-- Create assets + inventory tables if missing, then link purchase vouchers.

CREATE TABLE IF NOT EXISTS "assets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "purchaseDate" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT '',
    "assignee" TEXT NOT NULL DEFAULT '',
    "warranty" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'In Use',
    "notes" TEXT DEFAULT '',
    "voucherId" TEXT,
    "voucherNo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "item" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pc',
    "reorder" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "value" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'In Stock',
    "voucherId" TEXT,
    "voucherNo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- If tables already existed without voucher columns (older deploys)
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "voucherId" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "voucherNo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "voucherId" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "voucherNo" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS "assets_schoolId_tag_key" ON "assets"("schoolId", "tag");
CREATE INDEX IF NOT EXISTS "assets_schoolId_idx" ON "assets"("schoolId");
CREATE INDEX IF NOT EXISTS "assets_schoolId_branchId_idx" ON "assets"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "assets_schoolId_status_idx" ON "assets"("schoolId", "status");

CREATE INDEX IF NOT EXISTS "inventory_items_schoolId_idx" ON "inventory_items"("schoolId");
CREATE INDEX IF NOT EXISTS "inventory_items_schoolId_branchId_idx" ON "inventory_items"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "inventory_items_schoolId_status_idx" ON "inventory_items"("schoolId", "status");

DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
