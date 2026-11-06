/**
 * Seed script — creates one demo school + admin so the API can be exercised
 * immediately after a fresh migration.
 *
 *   npm run seed
 *
 * Safe to run repeatedly: it skips creation when the demo account exists.
 */

require('../src/config/env');

const { prisma, connectDatabase, disconnectDatabase } = require('../src/config/database');
const authService = require('../src/services/auth/auth.service');

const DEMO = {
  schoolName: 'Demo Public School',
  name: 'Demo Admin',
  ownerName: 'Demo Owner',
  email: 'admin@demo.fastnxt.test',
  password: 'Password123',
  phone: '+92 300 0000000',
  country: 'Pakistan',
  city: 'Lahore',
};

async function main() {
  await connectDatabase();

  const existing = await prisma.user.findUnique({
    where: { email: DEMO.email.toLowerCase() },
  });

  if (existing) {
    console.log(`ℹ️  Demo account already exists: ${DEMO.email}`);
  } else {
    await authService.registerSchool(DEMO);
    console.log(`✅ Demo school created. Sign in with ${DEMO.email} / ${DEMO.password}`);
  }

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('❌ Seed failed:', error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
