/**
 * Main Admin Dashboard — one round-trip, parallel aggregations.
 * Optional `branchId` scopes campus-aware models; "all" / missing = school-wide.
 */

const { prisma } = require('../../config/database');

function branchFilter(branchId) {
  if (!branchId || branchId === 'all') return {};
  return { branchId };
}

async function getOverview(schoolId, { branchId } = {}) {
  const scoped = branchFilter(branchId);
  const allCampuses = !scoped.branchId;

  const studentWhere = { schoolId, ...scoped };
  const employeeWhere = { schoolId, ...scoped };
  const classWhere = { schoolId, ...scoped };
  const feeWhere = { schoolId, ...scoped };
  const eventWhere = { schoolId, ...scoped, status: { in: ['Upcoming', 'Scheduled', 'Published'] } };

  const today = new Date().toISOString().slice(0, 10);

  const [
    totalStudents,
    activeStudents,
    inactiveStudents,
    totalClasses,
    totalEmployees,
    activeEmployees,
    feeAgg,
    feeByStatus,
    genderGroups,
    recentAdmissions,
    upcomingEvents,
    branches,
  ] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.student.count({ where: { ...studentWhere, status: 'Active' } }),
    prisma.student.count({ where: { ...studentWhere, status: { not: 'Active' } } }),
    prisma.class.count({ where: { ...classWhere, status: 'Active' } }),
    prisma.employee.count({ where: employeeWhere }),
    prisma.employee.count({ where: { ...employeeWhere, status: 'Active' } }),
    prisma.feeInvoice.aggregate({
      where: feeWhere,
      _sum: { paid: true, balance: true, total: true },
    }),
    prisma.feeInvoice.groupBy({
      by: ['status'],
      where: feeWhere,
      _count: { _all: true },
      _sum: { paid: true, balance: true },
    }),
    prisma.student.groupBy({
      by: ['gender'],
      where: studentWhere,
      _count: { _all: true },
    }),
    prisma.student.findMany({
      where: studentWhere,
      orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        studentId: true,
        name: true,
        cls: true,
        section: true,
        guardian: true,
        father: true,
        status: true,
        admissionDate: true,
        branchId: true,
      },
    }),
    prisma.event.findMany({
      where: {
        schoolId,
        ...scoped,
        OR: [
          { status: { in: ['Upcoming', 'Scheduled', 'Published'] } },
          { startDate: { gte: today } },
        ],
      },
      orderBy: { startDate: 'asc' },
      take: 6,
      select: {
        id: true,
        title: true,
        type: true,
        startDate: true,
        venue: true,
        status: true,
        branchId: true,
      },
    }),
    allCampuses
      ? prisma.branch.findMany({
          where: { schoolId, status: 'ACTIVE' },
          orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  const collectedFees = feeAgg._sum.paid || 0;
  const pendingFees = feeAgg._sum.balance || 0;

  const feeStatus = { Paid: 0, 'Partially Paid': 0, Pending: 0, Overdue: 0 };
  let paidInvoices = 0;
  let overdueInvoices = 0;
  for (const row of feeByStatus) {
    const n = row._count._all || 0;
    feeStatus[row.status] = n;
    if (row.status === 'Paid') paidInvoices = n;
    if (row.status === 'Overdue') overdueInvoices = n;
  }

  const gender = { Male: 0, Female: 0, Other: 0 };
  for (const row of genderGroups) {
    const g = row.gender || 'Other';
    if (g === 'Male' || g === 'Female') gender[g] = row._count._all;
    else gender.Other += row._count._all;
  }

  // School-level P&L (journals are not branch-scoped). Campus view uses fee totals as money KPIs.
  let income = collectedFees;
  let expenses = 0;
  if (allCampuses) {
    try {
      const ledgerService = require('../accounts/ledger.service');
      const accountService = require('../accounts/account.service');
      await accountService.ensureDefaultChartOfAccounts(schoolId);
      const pl = await ledgerService.profitAndLoss(schoolId);
      income = pl.totalIncome || collectedFees;
      expenses = pl.totalExpenses || 0;
    } catch {
      // Keep fee-based fallbacks
    }
  }

  let branchPerformance = [];
  if (allCampuses && branches.length > 0) {
    branchPerformance = await Promise.all(
      branches.map(async (b) => {
        const bw = { schoolId, branchId: b.id };
        const [students, employees, fees] = await Promise.all([
          prisma.student.count({ where: { ...bw, status: 'Active' } }),
          prisma.employee.count({ where: { ...bw, status: 'Active' } }),
          prisma.feeInvoice.aggregate({
            where: bw,
            _sum: { paid: true, balance: true },
          }),
        ]);
        return {
          branchId: b.id,
          branchName: b.name,
          branchCode: b.code,
          students,
          employees,
          feeCollection: fees._sum.paid || 0,
          outstanding: fees._sum.balance || 0,
        };
      })
    );
  }

  return {
    scope: allCampuses ? 'all' : branchId,
    stats: {
      totalStudents,
      activeStudents,
      inactiveStudents,
      totalClasses,
      totalEmployees,
      activeEmployees,
      pendingFees,
      collectedFees,
      income,
      expenses,
      paidInvoices,
      overdueInvoices,
    },
    gender,
    feeStatus,
    recentAdmissions: recentAdmissions.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      cls: s.cls,
      section: s.section,
      guardian: s.guardian || s.father || '—',
      status: s.status,
      admissionDate: s.admissionDate || '',
      branchId: s.branchId,
    })),
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type || 'Event',
      date: e.startDate || '',
      venue: e.venue || '',
      status: e.status,
      branchId: e.branchId,
    })),
    branchPerformance,
  };
}

module.exports = { getOverview };
