/**
 * Platform admin — list / inspect registered schools.
 */

const prisma = require('../../config/database').prisma;
const { notFound } = require('../../utils/errors');
const schoolService = require('../school/school.service');
const subscriptionRules = require('../../utils/subscription');

function pickLatestSubscription(subscriptions = []) {
  if (!subscriptions.length) return null;
  return [...subscriptions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

function serializeListItem(school) {
  const subscription = pickLatestSubscription(school.subscriptions);
  const now = new Date();
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
  const latest = school.subscriptions[0] || null;

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
      subscription: subscriptionRules.toPayload(latest, now),
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
  for (const school of allSchools) {
    const sub = pickLatestSubscription(school.subscriptions);
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
    },
    recentSchools: allSchools.slice(0, 8).map(serializeListItem),
  };
}

module.exports = { listSchools, getSchool, dashboardStats };
