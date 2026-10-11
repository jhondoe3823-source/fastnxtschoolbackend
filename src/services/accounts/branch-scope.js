/**
 * Branch scoping for accounting transactions.
 * Chart of Accounts stays school-wide; journals / vouchers / banks / budgets
 * are tagged with a campus and filtered by the sidebar selection.
 */

const { prisma } = require('../../config/database');
const { badRequest } = require('../../utils/errors');

/** Prisma where fragment for list/report queries. */
function branchWhere(branchId) {
  if (!branchId || branchId === 'all') return {};
  return { branchId };
}

/**
 * Resolve a concrete campus id for new postings.
 * When the UI is in "All campuses" mode, fall back to the school's main branch.
 */
async function resolveBranchId(schoolId, branchId) {
  if (branchId && branchId !== 'all') {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, schoolId } });
    if (!branch) throw badRequest('Selected campus was not found for this school.');
    return branch.id;
  }
  const main = await prisma.branch.findFirst({
    where: { schoolId },
    orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
  });
  if (!main) throw badRequest('No campus is configured. Add a branch before posting accounting entries.');
  return main.id;
}

module.exports = { branchWhere, resolveBranchId };
