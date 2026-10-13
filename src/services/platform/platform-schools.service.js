/**
 * Platform admin — list / inspect / manage registered schools.
 *
 * Mutations available to the platform console:
 *   • activate / deactivate a school (blocks login when off)
 *   • extend a free trial by N days
 *   • switch the school onto MONTHLY or YEARLY
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');
const schoolService = require('../school/school.service');
const subscriptionRules = require('../../utils/subscription');
const {
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  PAID_PLANS,
} = require('../../constants');

function currentSubscription(subscriptions = [], now = new Date()) {
  return subscriptionRules.selectCurrent(subscriptions, now);
}

function serializeListItem(school) {
  const now = new Date();
  const subscription = currentSubscription(school.subscriptions, now);
  return {
    id: school.id,
    name: school.name,
    shortName: school.shortName || null,
    ownerName: school.ownerName,
    email: school.email,
    phone: school.phone,
    country: school.country,
    city: school.city,
    logoUrl: school.logoUrl || null,
    isActive: school.isActive !== false,
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
    branches: school._count?.branches ?? school.branches?.length ?? 0,
    users: school._count?.users ?? 0,
    students: school._count?.students ?? 0,
    employees: school._count?.employees ?? 0,
    subscription: subscriptionRules.toPayload(subscription, now),
  };
}

const schoolListSelect = {
  id: true,
  name: true,
  shortName: true,
  ownerName: true,
  email: true,
  phone: true,
  country: true,
  city: true,
  logoUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  subscriptions: true,
  _count: {
    select: {
      users: true,
      students: true,
      employees: true,
      branches: true,
    },
  },
};

async function listSchools({ q } = {}) {
  const query = String(q || '').trim();
  const schools = await prisma.school.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { ownerName: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: schoolListSelect,
    orderBy: { createdAt: 'desc' },
  });

  return {
    schools: schools.map(serializeListItem),
    total: schools.length,
  };
}

async function getSchool(id) {
  const school = await prisma.school.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      shortName: true,
      ownerName: true,
      email: true,
      phone: true,
      country: true,
      city: true,
      address: true,
      website: true,
      motto: true,
      principal: true,
      academicSession: true,
      instituteNo: true,
      logoUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      subscriptions: { orderBy: { createdAt: 'desc' } },
      branches: { orderBy: [{ isMain: 'desc' }, { name: 'asc' }] },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          panel: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      _count: {
        select: {
          users: true,
          students: true,
          employees: true,
          branches: true,
          classes: true,
          feeInvoices: true,
        },
      },
    },
  });

  if (!school) throw notFound('School not found.');

  const now = new Date();
  const current = currentSubscription(school.subscriptions, now);

  return {
    school: {
      ...schoolService.serializeSchool(school),
      counts: school._count,
      branches: school.branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        city: b.city,
        phone: b.phone,
        status: b.status,
        isMain: b.isMain,
        createdAt: b.createdAt,
      })),
      users: school.users,
      subscriptions: school.subscriptions.map((s) => subscriptionRules.toPayload(s, now)),
      subscription: subscriptionRules.toPayload(current, now),
    },
  };
}

async function dashboardStats() {
  const now = new Date();
  const [totalSchools, totalStudents, totalEmployees, allSchools] = await Promise.all([
    prisma.school.count(),
    prisma.student.count(),
    prisma.employee.count(),
    prisma.school.findMany({
      select: schoolListSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  let active = 0;
  let trial = 0;
  let expired = 0;
  let deactivated = 0;
  for (const school of allSchools) {
    if (school.isActive === false) {
      deactivated += 1;
      continue;
    }
    const sub = currentSubscription(school.subscriptions, now);
    const payload = subscriptionRules.toPayload(sub, now);
    if (!payload || !payload.active) expired += 1;
    else if (payload.isTrial || String(payload.status).toUpperCase() === 'TRIAL') trial += 1;
    else active += 1;
  }

  return {
    stats: {
      totalSchools,
      totalStudents,
      totalEmployees,
      activeSubscriptions: active,
      trialSchools: trial,
      expiredSchools: expired,
      deactivatedSchools: deactivated,
    },
    recentSchools: allSchools.slice(0, 8).map(serializeListItem),
  };
}

async function assertSchool(id) {
  const school = await prisma.school.findUnique({
    where: { id },
    include: { subscriptions: true },
  });
  if (!school) throw notFound('School not found.');
  return school;
}

/** Activate or deactivate the whole school tenant. */
async function setSchoolActive(id, isActive) {
  if (typeof isActive !== 'boolean') {
    throw badRequest('isActive must be true or false.');
  }

  await assertSchool(id);
  const updated = await prisma.school.update({
    where: { id },
    data: { isActive },
  });

  logger.info(
    `Platform ${isActive ? 'activated' : 'deactivated'} school "${updated.name}" (${updated.id}).`
  );

  return getSchool(id);
}

/**
 * Extend the free trial by `days` (default 5).
 * If the school is already on an active trial, days are added to expiresAt.
 * Otherwise a fresh TRIAL row starts from now.
 */
async function extendTrial(id, days) {
  const extraDays = Number(days);
  if (!Number.isFinite(extraDays) || extraDays < 1 || extraDays > 365) {
    throw badRequest('days must be a number between 1 and 365.');
  }

  const school = await assertSchool(id);
  const now = new Date();
  const current = currentSubscription(school.subscriptions, now);
  const onActiveTrial =
    current &&
    current.plan === SUBSCRIPTION_PLAN.TRIAL &&
    !subscriptionRules.isExpired(current, now);

  if (onActiveTrial) {
    const newExpiry = subscriptionRules.addDays(new Date(current.expiresAt), extraDays);
    await prisma.subscription.update({
      where: { id: current.id },
      data: {
        expiresAt: newExpiry,
        status: SUBSCRIPTION_STATUS.TRIAL,
      },
    });
    logger.info(
      `Platform extended trial for school ${id} by ${extraDays} day(s) → ${newExpiry.toISOString()}.`
    );
  } else {
    const startedAt = now;
    const expiresAt = subscriptionRules.addDays(now, extraDays);
    await prisma.subscription.create({
      data: {
        schoolId: id,
        plan: SUBSCRIPTION_PLAN.TRIAL,
        status: SUBSCRIPTION_STATUS.TRIAL,
        startedAt,
        expiresAt,
      },
    });
    logger.info(
      `Platform started a ${extraDays}-day trial for school ${id} → ${expiresAt.toISOString()}.`
    );
  }

  return getSchool(id);
}

/**
 * Put the school on MONTHLY or YEARLY from today.
 * Creates a new subscription row; older rows lapse naturally via selectCurrent.
 */
async function setPlan(id, plan) {
  const nextPlan = String(plan || '').toUpperCase();
  if (!PAID_PLANS.includes(nextPlan)) {
    throw badRequest('plan must be MONTHLY or YEARLY.');
  }

  await assertSchool(id);
  const now = new Date();
  const { startedAt, expiresAt } = subscriptionRules.paidWindow(nextPlan, now);

  await prisma.subscription.create({
    data: {
      schoolId: id,
      plan: nextPlan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      startedAt,
      expiresAt,
    },
  });

  logger.info(
    `Platform set school ${id} to ${nextPlan} until ${expiresAt.toISOString()}.`
  );

  return getSchool(id);
}

module.exports = {
  listSchools,
  getSchool,
  dashboardStats,
  setSchoolActive,
  extendTrial,
  setPlan,
};
