/**
 * Journal Entry service — the double-entry engine.
 *
 * Rules enforced here:
 *   1. Debits must equal credits before an entry can be POSTED.
 *   2. Only POSTED entries affect balances (ledger.service reads status='Posted').
 *   3. Editing is only allowed on Draft entries; posted entries are reversed
 *      instead of mutated, preserving the audit trail.
 *   4. Every write that touches a journal runs inside a Prisma transaction so
 *      related records (vouchers, invoices) and their ledger never diverge.
 *   5. A posted entry can only be reversed once (idempotent guard).
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { badRequest, notFound, conflict } = require('../../utils/errors');
const { ERROR_CODES } = require('../../constants');

const VALID_STATUS = ['Draft', 'Posted', 'Cancelled'];

const trimmed = (value) => String(value ?? '').trim();
const toInt = (value) => Math.round(Number(value) || 0);

/** Load the account IDs referenced by a set of lines, validating ownership + active. */
async function loadAccounts(schoolId, lines) {
  const ids = [...new Set(lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: ids }, schoolId },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  for (const line of lines) {
    const account = byId.get(line.accountId);
    if (!account) {
      throw badRequest('One or more lines reference an account that does not exist or belongs to another school.');
    }
    if (!account.isActive) {
      throw badRequest(`Account "${account.name}" is inactive and cannot be used in a journal entry.`);
    }
  }
  return byId;
}

/** Validate that lines are non-empty, positive, and balanced. */
function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw badRequest('A journal entry needs at least two lines.');
  }

  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const d = toInt(line.debit);
    const c = toInt(line.credit);
    if (d < 0 || c < 0) throw badRequest('Debit and credit amounts cannot be negative.');
    if (d > 0 && c > 0) throw badRequest('A line cannot have both a debit and a credit.');
    if (d === 0 && c === 0) throw badRequest('Each line must have a debit or a credit amount.');
    debit += d;
    credit += c;
  }

  if (debit !== credit) {
    throw badRequest(
      `Journal entry is not balanced. Total debits (${debit}) must equal total credits (${credit}).`,
      [{ field: 'lines', message: `Difference of ${debit - credit}` }]
    );
  }
  return { debit, credit };
}

/** Next sequential JE number for a school, e.g. JE-0001. */
async function nextEntryNo(schoolId) {
  const last = await prisma.journalEntry.findFirst({
    where: { schoolId },
    orderBy: { no: 'desc' },
    select: { no: true },
  });
  const seq = last ? Number(String(last.no).replace(/\D/g, '')) + 1 : 1;
  return `JE-${String(seq).padStart(4, '0')}`;
}

/** Serialize a journal entry (with its lines) for the client. */
function serializeEntry(entry) {
  if (!entry) return null;
  const lines = (entry.lines || []).map((l) => ({
    id: l.id,
    accountId: l.accountId,
    account: l.account ? l.account.name : l.accountId,
    description: l.description || '',
    debit: l.debit || 0,
    credit: l.credit || 0,
  }));
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return {
    id: entry.id,
    no: entry.no,
    date: entry.date,
    description: entry.description,
    reference: entry.reference || '',
    status: entry.status,
    notes: entry.notes || '',
    by: entry.createdByName || '',
    postedAt: entry.postedAt,
    reversedFromId: entry.reversedFromId || null,
    lines,
    debit: totalDebit,
    credit: totalCredit,
  };
}
