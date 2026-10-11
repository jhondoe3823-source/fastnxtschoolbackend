/**
 * School rules & regulations — admin publishes; teachers/students read their audience.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest, forbidden } = require('../../utils/errors');
const { PANELS } = require('../../constants/roles');

const AUDIENCES = new Set(['Teachers', 'Students', 'Both']);
const STATUSES = new Set(['Active', 'Inactive']);

const trimmed = (val) => String(val ?? '').trim();

function isAdmin(auth) {
  const panel = String(auth?.panel || '').toLowerCase();
  const role = String(auth?.role || '').toLowerCase();
  return panel === PANELS.ADMIN || role === 'admin' || role === 'owner' || role === 'principal';
}

function serialize(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    status: row.status,
    branchId: row.branchId || null,
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listRules(schoolId, { branchId, audience, panel, status, q } = {}, auth = {}) {
  const where = { schoolId };

  if (branchId && branchId !== 'all') where.branchId = branchId;

  const panelKey = String(panel || '').toLowerCase();
  if (panelKey === 'teacher' || panelKey === 'teachers') {
    where.audience = { in: ['Teachers', 'Both'] };
    where.status = 'Active';
  } else if (panelKey === 'student' || panelKey === 'students') {
    where.audience = { in: ['Students', 'Both'] };
    where.status = 'Active';
  } else {
    // Admin / general list — optional exact filters
    if (audience && AUDIENCES.has(audience)) where.audience = audience;
    if (status && STATUSES.has(status)) where.status = status;
    // Non-admins only see active rules for their panel (fallback)
    if (!isAdmin(auth)) {
      const authPanel = String(auth.panel || '').toLowerCase();
      if (authPanel === PANELS.TEACHER) {
        where.audience = { in: ['Teachers', 'Both'] };
        where.status = 'Active';
      } else if (authPanel === PANELS.STUDENT) {
        where.audience = { in: ['Students', 'Both'] };
        where.status = 'Active';
      }
    }
  }

  if (q) {
    const query = trimmed(q);
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { body: { contains: query, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.schoolRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(serialize);
}

async function getRule(schoolId, id) {
  const row = await prisma.schoolRule.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Rule not found.');
  return serialize(row);
}

async function createRule(schoolId, input, auth = {}) {
  if (!isAdmin(auth)) throw forbidden('Only administrators can add rules.');

  const title = trimmed(input.title);
  const body = trimmed(input.body);
  if (!title) throw badRequest('Title is required.');
  if (!body) throw badRequest('Rule body is required.');

  const audience = trimmed(input.audience) || 'Both';
  if (!AUDIENCES.has(audience)) {
    throw badRequest('Audience must be Teachers, Students, or Both.');
  }

  const status = trimmed(input.status) || 'Active';
  if (!STATUSES.has(status)) throw badRequest('Status must be Active or Inactive.');

  const row = await prisma.schoolRule.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      title,
      body,
      audience,
      status,
      createdBy: auth.name || auth.userId || null,
    },
  });

  logger.info(`Created school rule "${row.title}" (${row.id}) for school ${schoolId}.`);
  return serialize(row);
}

async function updateRule(schoolId, id, input, auth = {}) {
  if (!isAdmin(auth)) throw forbidden('Only administrators can update rules.');

  const existing = await prisma.schoolRule.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Rule not found.');

  const data = {};
  if (input.title !== undefined) {
    const title = trimmed(input.title);
    if (!title) throw badRequest('Title is required.');
    data.title = title;
  }
  if (input.body !== undefined) {
    const body = trimmed(input.body);
    if (!body) throw badRequest('Rule body is required.');
    data.body = body;
  }
  if (input.audience !== undefined) {
    const audience = trimmed(input.audience);
    if (!AUDIENCES.has(audience)) {
      throw badRequest('Audience must be Teachers, Students, or Both.');
    }
    data.audience = audience;
  }
  if (input.status !== undefined) {
    const status = trimmed(input.status);
    if (!STATUSES.has(status)) throw badRequest('Status must be Active or Inactive.');
    data.status = status;
  }
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  const updated = await prisma.schoolRule.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteRule(schoolId, id, auth = {}) {
  if (!isAdmin(auth)) throw forbidden('Only administrators can delete rules.');

  const existing = await prisma.schoolRule.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Rule not found.');

  await prisma.schoolRule.delete({ where: { id: existing.id } });
  logger.info(`Deleted school rule "${existing.title}" (${existing.id}) for school ${schoolId}.`);
  return { id: existing.id, deleted: true };
}

module.exports = {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
};
