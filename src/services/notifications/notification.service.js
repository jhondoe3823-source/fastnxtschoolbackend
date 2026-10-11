/**
 * In-app notifications.
 */

const { prisma } = require('../../config/database');
const { notFound } = require('../../utils/errors');

function serialize(n) {
  if (!n) return null;
  return {
    id: n.id,
    schoolId: n.schoolId,
    userId: n.userId,
    title: n.title,
    message: n.message,
    icon: n.icon || 'system',
    tone: n.tone || 'blue',
    href: n.href || null,
    read: Boolean(n.readAt),
    readAt: n.readAt,
    floatedAt: n.floatedAt,
    createdAt: n.createdAt,
    time: relativeTime(n.createdAt),
  };
}

function relativeTime(date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toISOString().slice(0, 10);
}

async function createNotification({
  schoolId,
  userId,
  title,
  message,
  icon = 'system',
  tone = 'blue',
  href = null,
}) {
  const row = await prisma.notification.create({
    data: {
      schoolId,
      userId,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 2000),
      icon,
      tone,
      href,
    },
  });
  return serialize(row);
}

async function listForUser(userId, { limit = 50, unreadOnly = false } = {}) {
  const where = { userId };
  if (unreadOnly) where.readAt = null;
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 50, 100),
  });
  return rows.map(serialize);
}

async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

async function markRead(userId, id) {
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Notification not found.');
  if (existing.readAt) return serialize(existing);
  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return serialize(updated);
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

/** Unread notifications not yet floated on the dashboard (first-time only). */
async function listPendingFloat(userId, { limit = 5 } = {}) {
  const rows = await prisma.notification.findMany({
    where: { userId, floatedAt: null },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 5, 10),
  });
  return rows.map(serialize);
}

async function markFloated(userId, ids = []) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return { updated: 0 };
  const result = await prisma.notification.updateMany({
    where: { userId, id: { in: list }, floatedAt: null },
    data: { floatedAt: new Date() },
  });
  return { updated: result.count };
}

module.exports = {
  createNotification,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  listPendingFloat,
  markFloated,
  serialize,
};
