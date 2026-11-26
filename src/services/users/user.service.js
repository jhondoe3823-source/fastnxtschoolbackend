/**
 * User service — manage school login accounts (users).
 */

const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { conflict, notFound, badRequest } = require('../../utils/errors');
const { ERROR_CODES } = require('../../constants');

const SALT_ROUNDS = 10;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const trimmed = (value) => String(value ?? '').trim();

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    panel: user.panel,
    branchId: user.branchId || null,
    status: user.isActive ? 'Active' : 'Inactive',
    isActive: user.isActive,
    lastLogin: user.lastLoginAt ? user.lastLoginAt.toISOString() : '—',
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** List users for a school with optional filters. */
async function listUsers(schoolId, { q, role, status } = {}) {
  const where = { schoolId };

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (status) {
    if (status === 'Active') where.isActive = true;
    if (status === 'Inactive') where.isActive = false;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return users.map(serializeUser);
}

/** Get a single user by ID. */
async function getUser(schoolId, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId },
  });

  if (!user) {
    throw notFound('User not found.');
  }

  return serializeUser(user);
}

/** Create a new user account for a school. */
async function createUser(schoolId, input) {
  const name = trimmed(input.name);
  const email = normalizeEmail(input.email);
  const role = trimmed(input.role) || 'Teacher';
  const rawPassword = input.password || 'Password123';
  const isActive = input.status !== undefined ? input.status === 'Active' || input.status === true : true;

  if (!name) throw badRequest('Full name is required.');
  if (!email) throw badRequest('Email address is required.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw conflict('A user account with this email address already exists.', ERROR_CODES.EMAIL_IN_USE);
  }

  const passwordHash = await bcrypt.hash(rawPassword, SALT_ROUNDS);

  let panel = 'admin';
  const roleLower = role.toLowerCase();
  if (roleLower.includes('student')) panel = 'student';
  else if (roleLower.includes('teacher') || roleLower.includes('staff') || roleLower.includes('employee')) panel = 'teacher';
  else panel = 'admin';

  const user = await prisma.user.create({
    data: {
      schoolId,
      branchId: input.branchId || null,
      name,
      email,
      passwordHash,
      role,
      panel,
      isActive,
      emailVerified: true,
    },
  });

  logger.info(`Created user account "${user.email}" with role "${user.role}" for school ${schoolId}.`);
  return serializeUser(user);
}

/** Update an existing user account. */
async function updateUser(schoolId, userId, input) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, schoolId },
  });

  if (!existing) {
    throw notFound('User not found.');
  }

  const data = {};

  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.role !== undefined) data.role = trimmed(input.role);
  if (input.branchId !== undefined) data.branchId = input.branchId || null;
  if (input.status !== undefined) data.isActive = input.status === 'Active' || input.status === true;
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);

  if (input.password) {
    data.passwordHash = await bcrypt.hash(String(input.password), SALT_ROUNDS);
  }

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) throw conflict('Email address is already in use by another account.');
      data.email = email;
    }
  }

  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  logger.info(`Updated user "${updated.email}" (${updated.id}).`);
  return serializeUser(updated);
}

/** Reset user password. */
async function resetPassword(schoolId, userId, newPassword) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, schoolId },
  });

  if (!existing) {
    throw notFound('User not found.');
  }

  const password = newPassword || 'Password123';
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  logger.info(`Reset password for user "${existing.email}".`);
  return { success: true, message: `Password reset link sent / updated for ${existing.email}` };
}

/** Toggle user status. */
async function toggleStatus(schoolId, userId, status) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, schoolId },
  });

  if (!existing) {
    throw notFound('User not found.');
  }

  const isActive = status === 'Active' || status === true;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  logger.info(`Toggled user "${updated.email}" status to ${isActive ? 'Active' : 'Inactive'}.`);
  return serializeUser(updated);
}

/** Delete user account. */
async function deleteUser(schoolId, currentUserId, targetUserId) {
  if (currentUserId === targetUserId) {
    throw badRequest('You cannot delete your own logged in account.');
  }

  const existing = await prisma.user.findFirst({
    where: { id: targetUserId, schoolId },
  });

  if (!existing) {
    throw notFound('User not found.');
  }

  await prisma.user.delete({ where: { id: targetUserId } });
  logger.info(`Deleted user account "${existing.email}" (${targetUserId}).`);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  resetPassword,
  toggleStatus,
  deleteUser,
  serializeUser,
};
