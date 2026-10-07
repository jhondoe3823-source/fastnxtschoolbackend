/**
 * Authorization by role.
 *
 *   router.get('/', requireAuth, requireRole(ROLES.ADMIN), handler);
 *
 * Roles are plain strings (see constants/roles.js), so this stays a cheap
 * membership test.
 */

const ApiResponse = require('../utils/response');

function requireRole(...allowed) {
  const allowedRoles = allowed.flat().filter(Boolean);

  return (req, res, next) => {
    if (!req.auth) {
      return ApiResponse.unauthorized(res, 'Authentication required. Please sign in.');
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(req.auth.role)) {
      return next();
    }

    return ApiResponse.forbidden(
      res,
      'Your role does not have permission to perform this action.'
    );
  };
}

module.exports = { requireRole };
