/**
 * Branch scoping.
 *
 * Multi-branch filtering is not part of the authentication foundation, so the
 * helpers are deliberately inert: they return "no restriction", which keeps
 * every caller correct today and makes the future change local to this file.
 *
 * When branches land, `branchScopeFilter` should return
 * `{ branchId: { in: [...] } }` for a restricted user and `{}` for a user who
 * can see the whole school.
 */

/** @returns {object} an empty Prisma `where` fragment for an unrestricted user. */
function branchScopeFilter(/* user */) {
  return {};
}

/** True when the caller may act on the given branch. */
function canAccessBranch(/* user, branchId */) {
  return true;
}

/** Prisma `include` fragment that attaches branch info once branches exist. */
function branchInclude() {
  return undefined;
}

module.exports = { branchScopeFilter, canAccessBranch, branchInclude };
