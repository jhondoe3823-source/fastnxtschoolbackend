/**
 * Visitor service
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serialize(r) {
  return {
    id: r.id,
    visitor: r.visitor,
    phone: r.phone || '',
    purpose: r.purpose || '',
    host: r.host || '',
    badge: r.badge || '',
    date: r.date || '',
    inTime: r.inTime || '',
    outTime: r.outTime || '',
    status: r.status || 'In',
    branchId: r.branchId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listVisitors(schoolId, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.visitor.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getVisitor(schoolId, id) {
  const row = await prisma.visitor.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Visitor not found.');
  return serialize(row);
}

async function createVisitor(schoolId, input) {
  const visitor = trimmed(input.visitor);
  if (!visitor) throw badRequest('Visitor name is required.');

  const row = await prisma.visitor.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      visitor,
      phone: trimmed(input.phone) || null,
      purpose: trimmed(input.purpose) || null,
      host: trimmed(input.host) || null,
      badge: trimmed(input.badge) || null,
      date: trimmed(input.date) || null,
      inTime: trimmed(input.inTime) || null,
      outTime: trimmed(input.outTime) || null,
      status: trimmed(input.status) || 'In',
    },
  });
  return serialize(row);
}

async function updateVisitor(schoolId, id, input) {
  const existing = await prisma.visitor.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Visitor not found.');

  const data = {};
  if (input.visitor !== undefined) data.visitor = trimmed(input.visitor);
  if (input.phone !== undefined) data.phone = trimmed(input.phone) || null;
  if (input.purpose !== undefined) data.purpose = trimmed(input.purpose) || null;
  if (input.host !== undefined) data.host = trimmed(input.host) || null;
  if (input.badge !== undefined) data.badge = trimmed(input.badge) || null;
  if (input.date !== undefined) data.date = trimmed(input.date) || null;
  if (input.inTime !== undefined) data.inTime = trimmed(input.inTime) || null;
  if (input.outTime !== undefined) data.outTime = trimmed(input.outTime) || null;
  if (input.status !== undefined) data.status = trimmed(input.status) || 'In';
  if (input.branchId !== undefined) data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const updated = await prisma.visitor.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteVisitor(schoolId, id) {
  const existing = await prisma.visitor.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Visitor not found.');
  await prisma.visitor.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listVisitors, getVisitor, createVisitor, updateVisitor, deleteVisitor };
