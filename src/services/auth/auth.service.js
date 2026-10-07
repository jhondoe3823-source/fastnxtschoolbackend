/**
 * Auth service — school registration, sign-in and session hydration.
 *
 * All data access lives here; controllers stay thin and only translate the
 * result into HTTP.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { conflict, unauthorized, notFound } = require('../../utils/errors');
const subscriptionRules = require('../../utils/subscription');
const schoolService = require('../school/school.service');
const {
  ROLES,
  DEFAULT_ROLE,
  DEFAULT_PANEL,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  ERROR_CODES,
} = require('../../constants');

const SALT_ROUNDS = 10;

/** Emails are stored lowercase so uniqueness is effectively case-insensitive. */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const trimmed = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** Fields that are safe to send to the client (never passwordHash). */
function serializeUser(user, school, subscription, now = new Date()) {
  let userBranch = null;
  if (user.branchId && school?.branches?.length) {
    userBranch = school.branches.find((b) => b.id === user.branchId) || null;
  }
  if (!userBranch && school?.branches?.length) {
    userBranch = school.branches.find((b) => b.isMain) || school.branches[0] || null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    panel: user.panel,
    branchId: user.branchId || userBranch?.id || null,
    branch: userBranch ? {
      id: userBranch.id,
      name: userBranch.name,
      code: userBranch.code,
      city: userBranch.city,
    } : null,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    // One serializer for the school everywhere (auth + /api/school/profile), so
    // the shell, the dashboard and the Institute Profile page always agree.
    school: schoolService.serializeSchool(school),
    subscription: subscriptionRules.toPayload(subscription, now),
  };
}

/** A school is "usable" while its latest subscription has not lapsed. */
const isSubscriptionActive = (subscription) =>
  subscriptionRules.hasAccess(subscription);

/** Load a user with its school, branches, and every subscription row. */
function findUserWithSchool(where) {
  return prisma.user.findUnique({
    where,
    include: { school: { include: { subscriptions: true, branches: true } } },
  });
}

/**
 * Register a school together with its first administrator and a free trial.
 * Everything is written in one transaction: a school is never left without an
 * admin, and an admin is never left without a subscription.
 */
async function registerSchool(payload) {
  const email = normalizeEmail(payload.email);
  const name = trimmed(payload.name);
  const schoolName = trimmed(payload.schoolName);
  const ownerName = trimmed(payload.ownerName) || name;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw conflict(
      'An account with this email already exists. Try signing in instead.',
      ERROR_CODES.EMAIL_IN_USE
    );
  }

  const passwordHash = await bcrypt.hash(String(payload.password), SALT_ROUNDS);
  const now = new Date();
  const { startedAt, expiresAt } = subscriptionRules.trialWindow(now);

  try {
    return await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: schoolName,
          ownerName,
          email,
          phone: trimmed(payload.phone),
          country: trimmed(payload.country),
          city: trimmed(payload.city),
        },
      });

      // Create default branch for the school
      const branch = await tx.branch.create({
        data: {
          schoolId: school.id,
          name: 'Main Campus',
          code: 'MAIN',
          address: trimmed(payload.city) || '',
          city: trimmed(payload.city) || '',
          phone: trimmed(payload.phone) || '',
          status: 'ACTIVE',
          isMain: true,
        },
      });

      const user = await tx.user.create({
        data: {
          schoolId: school.id,
          branchId: branch.id,
          name,
          email,
          passwordHash,
          role: payload.role || DEFAULT_ROLE || ROLES.ADMIN,
          panel: DEFAULT_PANEL,
          emailVerified: true, // verification is out of scope for now
          lastLoginAt: now,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          schoolId: school.id,
          plan: SUBSCRIPTION_PLAN.TRIAL,
          status: SUBSCRIPTION_STATUS.TRIAL,
          startedAt,
          expiresAt,
        },
      });

      logger.info(
        `Registered school "${school.name}" with branch "${branch.name}" (trial ends ${expiresAt.toISOString()}).`
      );
      return { user, school, subscription, branch };
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw conflict(
        'An account with this email already exists. Try signing in instead.',
        ERROR_CODES.EMAIL_IN_USE
      );
    }
    throw error;
  }
}

/**
 * Verify credentials, refresh last-login, and correct the stored subscription
 * status if it lapsed while the school was away (self-healing read).
 */
async function login({ email, password }) {
  const user = await findUserWithSchool({ email: normalizeEmail(email) });

  // A single generic message for unknown email / inactive / wrong password so
  // the endpoint cannot be used to enumerate accounts.
  const invalid = () =>
    unauthorized('Invalid email or password.', ERROR_CODES.INVALID_CREDENTIALS);

  if (!user || !user.isActive) {
    if (!user) logger.warn(`Failed login for unknown email "${normalizeEmail(email)}".`);
    throw invalid();
  }

  const passwordMatches = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!passwordMatches) {
    logger.warn(`Failed login for ${user.email}.`);
    throw invalid();
  }

  const now = new Date();
  const subscription = subscriptionRules.selectCurrent(user.school?.subscriptions, now);
  const expectedStatus = subscriptionRules.persistedStatus(subscription, now);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });

  if (subscription && subscription.status !== expectedStatus) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: expectedStatus },
    });
    subscription.status = expectedStatus;
  }

  return { user: { ...user, lastLoginAt: now }, school: user.school, subscription };
}

/** Rebuild the session payload for GET /me. */
async function getSession(userId) {
  const user = await findUserWithSchool({ id: userId });
  if (!user || !user.isActive) {
    throw notFound('Your account no longer exists. Please register again.');
  }

  const now = new Date();
  const subscription = subscriptionRules.selectCurrent(user.school?.subscriptions, now);
  const expectedStatus = subscriptionRules.persistedStatus(subscription, now);

  if (subscription && subscription.status !== expectedStatus) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: expectedStatus },
    });
    subscription.status = expectedStatus;
  }

  return { user, school: user.school, subscription };
}

/** Update the current user's profile (partial update). */
async function updateProfile(userId, updates) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw notFound('Your account no longer exists. Please register again.');
  }

  const data = {};
  const allowedFields = ['name']; // User model only has name, phone is on School model

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      data[field] = trimmed(updates[field]);
    }
  }

  if (Object.keys(data).length === 0) {
    return user;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  logger.info(`Updated profile for user "${updated.email}" (${updated.id}).`);
  return updated;
}

/** Convenience wrapper used by the controller. */
const buildSessionPayload = ({ user, school, subscription }) =>
  serializeUser(user, school, subscription);

module.exports = {
  registerSchool,
  login,
  getSession,
  updateProfile,
  serializeUser,
  buildSessionPayload,
  isSubscriptionActive,
  normalizeEmail,
};
