/**
 * Meeting service
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serialize(r) {
  return {
    id: r.id,
    title: r.title,
    date: r.date || '',
    time: r.time || '',
    venue: r.venue || '',
    organizer: r.organizer || '',
    status: r.status || 'Scheduled',
    description: r.description || '',
    participants: r.participants || [],
    branchId: r.branchId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listMeetings(schoolId, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.meeting.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getMeeting(schoolId, id) {
  const row = await prisma.meeting.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Meeting not found.');
  return serialize(row);
}

async function createMeeting(schoolId, input) {
  const title = trimmed(input.title);
  if (!title) throw badRequest('Title is required.');

  const row = await prisma.meeting.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      title,
      date: trimmed(input.date) || null,
      time: trimmed(input.time) || null,
      venue: trimmed(input.venue) || null,
      organizer: trimmed(input.organizer) || null,
      status: trimmed(input.status) || 'Scheduled',
      description: trimmed(input.description) || null,
      participants: Array.isArray(input.participants) ? input.participants : [],
    },
  });
  return serialize(row);
}

async function updateMeeting(schoolId, id, input) {
  const existing = await prisma.meeting.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Meeting not found.');

  const data = {};
  if (input.title !== undefined) data.title = trimmed(input.title);
  if (input.date !== undefined) data.date = trimmed(input.date) || null;
  if (input.time !== undefined) data.time = trimmed(input.time) || null;
  if (input.venue !== undefined) data.venue = trimmed(input.venue) || null;
  if (input.organizer !== undefined) data.organizer = trimmed(input.organizer) || null;
  if (input.status !== undefined) data.status = trimmed(input.status) || 'Scheduled';
  if (input.description !== undefined) data.description = trimmed(input.description) || null;
  if (input.participants !== undefined) data.participants = Array.isArray(input.participants) ? input.participants : [];
  if (input.branchId !== undefined) data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const updated = await prisma.meeting.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteMeeting(schoolId, id) {
  const existing = await prisma.meeting.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Meeting not found.');
  await prisma.meeting.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting };
