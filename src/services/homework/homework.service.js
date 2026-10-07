/**
 * Homework / Assignment service
 * Handles full CRUD with branch scoping and file attachments.
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serialize(r) {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    cls: r.cls,
    section: r.section,
    teacher: r.teacher,
    teacherId: r.teacherId || null,
    assigned: r.assigned || '',
    due: r.due || '',
    instructions: r.instructions || '',
    status: r.status || 'Open',
    submitted: r.submitted || 0,
    total: r.total || 0,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    branchId: r.branchId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listHomework(schoolId, { branchId, teacher, cls, section, status } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (teacher) where.teacher = { contains: teacher, mode: 'insensitive' };
  if (cls) where.cls = cls;
  if (section) where.section = section;
  if (status) where.status = status;

  const rows = await prisma.homework.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getHomework(schoolId, id) {
  const row = await prisma.homework.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Homework not found.');
  return serialize(row);
}

async function createHomework(schoolId, input) {
  const title = trimmed(input.title);
  if (!title) throw badRequest('Title is required.');
  if (!input.subject) throw badRequest('Subject is required.');
  if (!input.cls) throw badRequest('Class is required.');
  if (!input.section) throw badRequest('Section is required.');
  if (!input.due) throw badRequest('Due date is required.');

  const today = new Date().toISOString().slice(0, 10);

  const row = await prisma.homework.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      title,
      subject: trimmed(input.subject),
      cls: trimmed(input.cls),
      section: trimmed(input.section),
      teacher: trimmed(input.teacher) || 'Teacher',
      teacherId: input.teacherId || null,
      assigned: trimmed(input.assigned) || today,
      due: trimmed(input.due),
      instructions: trimmed(input.instructions) || null,
      status: trimmed(input.status) || 'Open',
      submitted: Number(input.submitted) || 0,
      total: Number(input.total) || 0,
      attachments: Array.isArray(input.attachments) ? input.attachments : [],
    },
  });
  return serialize(row);
}

async function updateHomework(schoolId, id, input) {
  const existing = await prisma.homework.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Homework not found.');

  const data = {};
  if (input.title !== undefined) data.title = trimmed(input.title);
  if (input.subject !== undefined) data.subject = trimmed(input.subject);
  if (input.cls !== undefined) data.cls = trimmed(input.cls);
  if (input.section !== undefined) data.section = trimmed(input.section);
  if (input.teacher !== undefined) data.teacher = trimmed(input.teacher);
  if (input.teacherId !== undefined) data.teacherId = input.teacherId;
  if (input.assigned !== undefined) data.assigned = trimmed(input.assigned);
  if (input.due !== undefined) data.due = trimmed(input.due);
  if (input.instructions !== undefined) data.instructions = trimmed(input.instructions) || null;
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.submitted !== undefined) data.submitted = Number(input.submitted);
  if (input.total !== undefined) data.total = Number(input.total);
  if (input.attachments !== undefined) data.attachments = Array.isArray(input.attachments) ? input.attachments : [];
  if (input.branchId !== undefined) data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const updated = await prisma.homework.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteHomework(schoolId, id) {
  const existing = await prisma.homework.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Homework not found.');
  await prisma.homework.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listHomework, getHomework, createHomework, updateHomework, deleteHomework };
