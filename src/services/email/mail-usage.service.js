/**
 * Per-school outbound mail usage totals.
 * Exposed via API for later billing / quotas — not wired into the UI yet.
 */

const { prisma } = require('../../config/database');

async function getSchoolMailUsage(schoolId) {
  const [agg, byStatus, byTemplate, recent] = await Promise.all([
    prisma.mailLog.aggregate({
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.mailLog.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    }),
    prisma.mailLog.groupBy({
      by: ['template'],
      where: { schoolId },
      _count: { _all: true },
      orderBy: { template: 'asc' },
    }),
    prisma.mailLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        template: true,
        brand: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const sent = byStatus.find((r) => r.status === 'sent')?._count._all || 0;
  const failed = byStatus.find((r) => r.status === 'failed')?._count._all || 0;
  const skipped = byStatus.find((r) => r.status === 'skipped')?._count._all || 0;

  return {
    schoolId,
    totalEmails: agg._count._all || 0,
    sent,
    failed,
    skipped,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byTemplate: byTemplate.map((r) => ({ template: r.template, count: r._count._all })),
    recent,
  };
}

module.exports = { getSchoolMailUsage };
