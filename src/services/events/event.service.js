/**
 * Event service
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serialize(r) {
  return {
    id: r.id,
    title: r.title,
    type: r.type || '',
    startDate: r.startDate || '',
    endDate: r.endDate || '',
    venue: r.venue || '',
    audience: r.audience || '',
    status: r.status || 'Upcoming',
    branchId: r.branchId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listEvents(schoolId, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getEvent(schoolId, id) {
  const row = await prisma.event.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Event not found.');
  return serialize(row);
}

async function createEvent(schoolId, input) {
  const title = trimmed(input.title);
  if (!title) throw badRequest('Title is required.');

  const row = await prisma.event.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      title,
      type: trimmed(input.type) || null,
      startDate: trimmed(input.startDate) || null,
      endDate: trimmed(input.endDate) || null,
      venue: trimmed(input.venue) || null,
      audience: trimmed(input.audience) || null,
      status: trimmed(input.status) || 'Upcoming',
    },
  });
  return serialize(row);
}

async function updateEvent(schoolId, id, input) {
  const existing = await prisma.event.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Event not found.');

  const data = {};
  if (input.title !== undefined) data.title = trimmed(input.title);
  if (input.type !== undefined) data.type = trimmed(input.type) || null;
  if (input.startDate !== undefined) data.startDate = trimmed(input.startDate) || null;
  if (input.endDate !== undefined) data.endDate = trimmed(input.endDate) || null;
  if (input.venue !== undefined) data.venue = trimmed(input.venue) || null;
  if (input.audience !== undefined) data.audience = trimmed(input.audience) || null;
  if (input.status !== undefined) data.status = trimmed(input.status) || 'Upcoming';
  if (input.branchId !== undefined) data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const updated = await prisma.event.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteEvent(schoolId, id) {
  const existing = await prisma.event.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Event not found.');
  await prisma.event.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent };
