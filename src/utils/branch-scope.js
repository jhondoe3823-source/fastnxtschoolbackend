

/** @returns {object} an empty Prisma `where` fragment for an unrestricted user. */
function branchScopeFilter(/* user */) {
  return {};
}

function canAccessBranch(/* user, branchId */) {
  return true;
}
function branchInclude() {
  return undefined;
}

module.exports = { branchScopeFilter, canAccessBranch, branchInclude };
