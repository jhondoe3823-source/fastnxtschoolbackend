/**
 * Platform-admin auth — separate from school User sessions.
 * Tokens must carry `kind: "platform"`.
 */

const { verifyToken } = require('../utils/token');
const ApiResponse = require('../utils/response');
const env = require('../config/env');
const logger = require('../utils/logger');

function readPlatformToken(req) {
  const fromCookie = req.cookies?.[env.platform.cookieName];
  if (fromCookie) return String(fromCookie).trim();

  const header = req.headers?.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

async function requirePlatformAuth(req, res, next) {
  const token = readPlatformToken(req);
  if (!token) {
    return ApiResponse.unauthorized(res, 'Platform authentication required. Please sign in.');
  }

  try {
    const payload = verifyToken(token);
    if (payload.kind !== 'platform') {
      return ApiResponse.unauthorized(res, 'Invalid platform session.');
    }
    const email = String(payload.sub || '').toLowerCase();
    if (!email || !env.platform.emails.includes(email)) {
      return ApiResponse.unauthorized(res, 'This account is not allowed on the platform admin.');
    }
    req.platformAuth = {
      email,
      name: payload.name || email,
    };
    req.platformToken = token;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Your session has expired. Please sign in again.');
    }
    logger.warn('Rejected a request with an invalid platform session token.');
    return ApiResponse.unauthorized(res, 'Invalid platform session. Please sign in again.');
  }
}

module.exports = { requirePlatformAuth, readPlatformToken };
