/**
 * Postings loader — the ONLY query the reporting math trusts.
 *
 * Financial balances, trial balance, P&L, balance sheet and the general ledger
 * all read POSTED journal lines through here. Draft and cancelled entries are
 * excluded by construction, so a draft can never move a balance. Drafts only
 * become real when `journal.service` flips them to Posted.
 */

const prisma = require('../../config/database').prisma;
const { ENTRY_STATUS } = require('../../constants');

/**
 * Fetch posted journal lines for a school.
 * @param {string} schoolId
 * @param {{ accountIds?: string[], from?: Date, to?: Date, accountId?: string }} [filter]
 */
async function postedLines(schoolId, { accountIds, from, to } = {}) {
  const where = { entry: { schoolId, status: ENTRY_STATUS.POSTED } };
  if (Array.isArray(accountIds) && accountIds.length > 0) where.accountId = { in: accountIds };
  if (from || to) {
    where.entry = {
      ...where.entry,
      date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
    };
  }

  return prisma.journalLine.findMany({
    where,
    select: {
      accountId: true,
      debit: true,
      credit: true,
      description: true,
      entry: { select: { date: true, reference: true, description: true } },
    },
  });
}

/** Posted journal lines shaped for the general ledger of one account. */
async function postedLinesForAccount(schoolId, accountId, { from, to } = {}) {
  const lines = await postedLines(schoolId, { accountIds: [accountId], from, to });
  return lines.map((line) => ({
    date: line.entry.date,
    reference: line.entry.reference || '',
    description: line.description || line.entry.description || '',
    debit: line.debit,
    credit: line.credit,
  }));
}

module.exports = { postedLines, postedLinesForAccount };
