/**
 * Authentication middleware.
 *
 * `requireAuth` verifies the session token (httpOnly cookie or Bearer header)
 * and attaches a minimal identity to `req.auth`. It deliberately does NOT load
 * the user from the database — that keeps every request to a single query,
 * because controllers that need the full record (e.g. GET /me) fetch it
 * themselves via the auth service.
 *
 * Use `attachUser` when a handler genuinely needs the fresh user + subscription.
 */

const { readTokenFromRequest, verifyToken } = require('../utils/token');
const ApiResponse = require('../utils/response');
const authService = require('../services/auth/auth.service');
const logger = require('../utils/logger');

async function requireAuth(req, res, next) {
  const token = readTokenFromRequest(req);

  if (!token) {
    return ApiResponse.unauthorized(res, 'Authentication required. Please sign in.');
  }

  try {
    const payload = verifyToken(token);

    req.auth = {
      userId: payload.sub,
      schoolId: payload.schoolId,
      role: payload.role,
      panel: payload.panel,
    };
    req.token = token;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Your session has expired. Please sign in again.');
    }
    logger.warn('Rejected a request with an invalid session token.');
    return ApiResponse.unauthorized(res, 'Invalid session. Please sign in again.');
  }
}

/** Loads the full user + school + subscription onto `req.authUser`. */
async function attachUser(req, res, next) {
  try {
    if (!req.auth?.userId) {
      return ApiResponse.unauthorized(res, 'Authentication required. Please sign in.');
    }
    const session = await authService.getSession(req.auth.userId);
    req.authUser = session.user;
    req.authSchool = session.school;
    req.authSubscription = session.subscription;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth, attachUser };
