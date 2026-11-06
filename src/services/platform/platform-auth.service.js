/**
 * Platform admin authentication — allowlisted emails only.
 */

const env = require('../../config/env');
const { unauthorized } = require('../../utils/errors');

const ADMIN_NAMES = {};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

function isAllowedEmail(email) {
  return env.platform.emails.includes(normalizeEmail(email));
}

function displayNameFor(email) {
  const key = normalizeEmail(email);
  return ADMIN_NAMES[key] || key.split('@')[0] || 'Platform Admin';
}

function login({ email, password }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    throw unauthorized('Email and password are required.');
  }
  if (!isAllowedEmail(normalized)) {
    throw unauthorized('This email is not authorised for the platform admin console.');
  }
  if (String(password) !== env.platform.password) {
    throw unauthorized('Invalid email or password.');
  }

  return {
    admin: {
      email: normalized,
      name: displayNameFor(normalized),
      role: 'PlatformAdmin',
    },
  };
}

function me(email) {
  const normalized = normalizeEmail(email);
  if (!isAllowedEmail(normalized)) {
    throw unauthorized('This email is not authorised for the platform admin console.');
  }
  return {
    admin: {
      email: normalized,
      name: displayNameFor(normalized),
      role: 'PlatformAdmin',
    },
  };
}

module.exports = { login, me, isAllowedEmail, displayNameFor };
