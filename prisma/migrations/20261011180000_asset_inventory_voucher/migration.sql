-- Link asset / inventory purchases to payment vouchers
ALTER TABLE "assets" ADD COLUMN "voucherId" TEXT;
ALTER TABLE "assets" ADD COLUMN "voucherNo" TEXT NOT NULL DEFAULT '';

ALTER TABLE "inventory_items" ADD COLUMN "voucherId" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN "voucherNo" TEXT NOT NULL DEFAULT '';
