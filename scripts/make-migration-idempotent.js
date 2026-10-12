const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20261009183000_school_mgmt_and_accounting",
  "migration.sql"
);

let sql = fs.readFileSync(file, "utf8");

sql = sql.replace(
  /ALTER TABLE "([^"]+)" ADD COLUMN\s+"/g,
  'ALTER TABLE "$1" ADD COLUMN IF NOT EXISTS "'
);

sql = sql.replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "');
sql = sql.replace(/CREATE UNIQUE INDEX "/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "');
sql = sql.replace(/CREATE INDEX "/g, 'CREATE INDEX IF NOT EXISTS "');

sql = sql.replace(
  /-- AddForeignKey\r?\nALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" ([^;]+);/g,
  (_m, table, constraint, rest) =>
    `-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" ${rest};
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`
);

fs.writeFileSync(file, sql);
console.log("Made idempotent:", file);
