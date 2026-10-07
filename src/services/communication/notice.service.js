/**
 * Notice service — supports Admin notices & Teacher class notices
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serialize(r) {
  return {
    id: r.id,
    title: r.title,
    content: r.content || '',
    audience: r.audience || '',
    channel: r.channel || '',
    type: r.type || '',
    date: r.date || '',
    reach: r.reach || 0,
    status: r.status || 'Draft',
    author: r.author || null,
    authorId: r.authorId || null,
    cls: r.cls || null,
    section: r.section || null,
    branchId: r.branchId || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listNotices(schoolId, { branchId, author, audience, cls, section } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (audience) where.audience = audience;
  if (cls) where.cls = cls;
  if (section) where.section = section;
  if (author) where.author = { contains: author, mode: 'insensitive' };

  const rows = await prisma.notice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getNotice(schoolId, id) {
  const row = await prisma.notice.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Notice not found.');
  return serialize(row);
}

async function createNotice(schoolId, input) {
  const title = trimmed(input.title);
  if (!title) throw badRequest('Title is required.');

  const today = new Date().toISOString().slice(0, 10);

  const row = await prisma.notice.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      title,
      content: trimmed(input.content) || null,
      audience: trimmed(input.audience) || null,
      channel: trimmed(input.channel) || 'App',
      type: trimmed(input.type) || 'Notice',
      date: trimmed(input.date) || today,
      reach: parseInt(input.reach) || 0,
      status: trimmed(input.status) || 'Published',
      author: trimmed(input.author) || null,
      authorId: input.authorId || null,
      cls: trimmed(input.cls) || null,
      section: trimmed(input.section) || null,
    },
  });
  return serialize(row);
}

async function updateNotice(schoolId, id, input) {
  const existing = await prisma.notice.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Notice not found.');

  const data = {};
  if (input.title !== undefined) data.title = trimmed(input.title);
  if (input.content !== undefined) data.content = trimmed(input.content) || null;
  if (input.audience !== undefined) data.audience = trimmed(input.audience) || null;
  if (input.channel !== undefined) data.channel = trimmed(input.channel) || null;
  if (input.type !== undefined) data.type = trimmed(input.type) || null;
  if (input.date !== undefined) data.date = trimmed(input.date) || null;
  if (input.reach !== undefined) data.reach = parseInt(input.reach) || 0;
  if (input.status !== undefined) data.status = trimmed(input.status) || 'Draft';
  if (input.author !== undefined) data.author = trimmed(input.author) || null;
  if (input.authorId !== undefined) data.authorId = input.authorId || null;
  if (input.cls !== undefined) data.cls = trimmed(input.cls) || null;
  if (input.section !== undefined) data.section = trimmed(input.section) || null;
  if (input.branchId !== undefined) data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const updated = await prisma.notice.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteNotice(schoolId, id) {
  const existing = await prisma.notice.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Notice not found.');
  await prisma.notice.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listNotices, getNotice, createNotice, updateNotice, deleteNotice };
