/**
 * Branch scoping middleware.
 *
 * Multi-branch support is not part of the auth foundation. `req.branchScope`
 * is populated with the (currently unrestricted) Prisma `where` fragment so
 * future handlers can spread it into their queries without being rewritten:
 *
 *   prisma.student.findMany({ where: { schoolId, ...req.branchScope.filter } })
 */

const { branchScopeFilter } = require('../utils/branch-scope');

function branchScope(req, res, next) {
  req.branchScope = {
    filter: branchScopeFilter(req.authUser, req.auth),
    branchId: null,
  };
  return next();
}

module.exports = { branchScope };
