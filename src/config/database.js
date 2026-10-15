/**
 * Prisma client singleton.
 *
 * A single PrismaClient is shared process-wide. In development `nodemon`
 * restarts the process on every save, which would otherwise leak a new
 * connection pool each time — caching on `globalThis` prevents that.
 */

const { PrismaClient } = require('@prisma/client');
const env = require('./env');
const logger = require('../utils/logger');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__bisonsPrisma ||
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.__bisonsPrisma = prisma;
}

/**
 * Safety net for deploys where `prisma migrate deploy` did not run (or failed).
 * Keeps fee payment + receipt endpoints from crashing on missing snapshot columns.
 */
async function ensureFeePaymentCashBankColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "cashBankAccountId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "cashBankAccountName" TEXT NOT NULL DEFAULT '';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "cashBankAccountNumber" TEXT NOT NULL DEFAULT '';
  `);
}

/**
 * Verify the connection on boot so a bad DATABASE_URL fails loudly instead of
 * surfacing as a confusing 500 on the first request.
 */
async function connectDatabase() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    try {
      await ensureFeePaymentCashBankColumns();
    } catch (schemaError) {
      // Do not block boot on a race with a concurrent migrate; log and continue.
      logger.warn('Could not ensure fee_payments cash/bank columns:', schemaError.message);
    }
    logger.info('Database connection established.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error.message);
    throw error;
  }
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

// Explicit named exports — a PrismaClient instance is a Proxy, so hanging our
// helpers off it would be fragile.
module.exports = { prisma, connectDatabase, disconnectDatabase };
