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
const { branchWhere, resolveBranchId } = require('./branch-scope');

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
    accountCode: l.account ? l.account.code : '',
    description: l.description || '',
    debit: l.debit || 0,
    credit: l.credit || 0,
  }));
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return {
    id: entry.id,
    no: entry.no,
    branchId: entry.branchId || null,
    date: entry.date ? entry.date.toISOString().slice(0, 10) : '',
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

/** List journal entries for a school with optional filters. */
async function listEntries(schoolId, { status, from, to, q, branchId } = {}) {
  const where = { schoolId, ...branchWhere(branchId) };
  if (status && VALID_STATUS.includes(status)) where.status = status;

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  if (q) {
    const term = trimmed(q);
    where.OR = [
      { no: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { reference: { contains: term, mode: 'insensitive' } },
      { createdByName: { contains: term, mode: 'insensitive' } },
    ];
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  return entries.map(serializeEntry);
}

/** Get a single journal entry by ID. */
async function getEntry(schoolId, entryId) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, schoolId },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    },
  });
  if (!entry) throw notFound('Journal entry not found.');
  return serializeEntry(entry);
}

/** Create a new journal entry (Draft or Posted). */
async function createEntry(schoolId, input, auth = {}) {
  const description = trimmed(input.description);
  if (!description) throw badRequest('Description is required.');

  const date = input.date ? new Date(input.date) : new Date();
  const reference = trimmed(input.reference);
  const notes = trimmed(input.notes);
  const status = input.status && VALID_STATUS.includes(input.status) ? input.status : 'Draft';

  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  if (rawLines.length < 2) throw badRequest('Journal entry requires at least two lines.');

  // Validate balanced debits and credits
  validateLines(rawLines);
  await loadAccounts(schoolId, rawLines);

  const no = trimmed(input.no) || (await nextEntryNo(schoolId));
  const createdByName = auth.name || auth.userName || 'System';
  const resolvedBranchId = await resolveBranchId(schoolId, input.branchId);

  const entry = await prisma.journalEntry.create({
    data: {
      schoolId,
      branchId: resolvedBranchId,
      no,
      date,
      description,
      reference,
      status,
      notes,
      createdById: auth.id || null,
      createdByName,
      postedAt: status === 'Posted' ? new Date() : null,
      lines: {
        create: rawLines.map((l) => ({
          accountId: l.accountId,
          description: trimmed(l.description) || description,
          debit: toInt(l.debit),
          credit: toInt(l.credit),
        })),
      },
    },
    include: {
      lines: {
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  logger.info(`Created journal entry ${entry.no} (${status}) for school ${schoolId}.`);
  return serializeEntry(entry);
}

/** Update an existing Draft journal entry. */
async function updateEntry(schoolId, entryId, input, auth = {}) {
  const existing = await prisma.journalEntry.findFirst({
    where: { id: entryId, schoolId },
    include: { lines: true },
  });
  if (!existing) throw notFound('Journal entry not found.');
  if (existing.status !== 'Draft') {
    throw badRequest('Only Draft journal entries can be edited.');
  }

  const data = {};
  if (input.description !== undefined) data.description = trimmed(input.description);
  if (input.date !== undefined) data.date = new Date(input.date);
  if (input.reference !== undefined) data.reference = trimmed(input.reference);
  if (input.notes !== undefined) data.notes = trimmed(input.notes);

  if (Array.isArray(input.lines)) {
    validateLines(input.lines);
    await loadAccounts(schoolId, input.lines);

    await prisma.$transaction([
      prisma.journalLine.deleteMany({ where: { entryId } }),
      prisma.journalEntry.update({
        where: { id: entryId },
        data: {
          ...data,
          lines: {
            create: input.lines.map((l) => ({
              accountId: l.accountId,
              description: trimmed(l.description) || data.description || existing.description,
              debit: toInt(l.debit),
              credit: toInt(l.credit),
            })),
          },
        },
      }),
    ]);
  } else {
    await prisma.journalEntry.update({ where: { id: entryId }, data });
  }

  return getEntry(schoolId, entryId);
}

/** Post a draft journal entry so it takes financial effect. */
async function postEntry(schoolId, entryId, auth = {}) {
  const existing = await prisma.journalEntry.findFirst({
    where: { id: entryId, schoolId },
    include: { lines: true },
  });
  if (!existing) throw notFound('Journal entry not found.');
  if (existing.status === 'Posted') return serializeEntry(existing);
  if (existing.status === 'Cancelled') throw badRequest('Cancelled entries cannot be posted.');

  validateLines(existing.lines);

  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      status: 'Posted',
      postedAt: new Date(),
    },
    include: {
      lines: {
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  logger.info(`Posted journal entry ${updated.no} for school ${schoolId}.`);
  return serializeEntry(updated);
}

/** Cancel a journal entry. */
async function cancelEntry(schoolId, entryId, auth = {}) {
  const existing = await prisma.journalEntry.findFirst({
    where: { id: entryId, schoolId },
    include: { lines: true },
  });
  if (!existing) throw notFound('Journal entry not found.');
  if (existing.status === 'Cancelled') return serializeEntry(existing);

  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: { status: 'Cancelled' },
    include: {
      lines: {
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  logger.info(`Cancelled journal entry ${updated.no} for school ${schoolId}.`);
  return serializeEntry(updated);
}

/** Reverse a posted entry: creates a new journal entry with opposite debits/credits. */
async function reverseEntry(schoolId, entryId, auth = {}) {
  const original = await prisma.journalEntry.findFirst({
    where: { id: entryId, schoolId },
    include: { lines: true },
  });
  if (!original) throw notFound('Journal entry not found.');
  if (original.status !== 'Posted') throw badRequest('Only posted entries can be reversed.');

  const existingReversal = await prisma.journalEntry.findFirst({
    where: { schoolId, reversedFromId: entryId },
  });
  if (existingReversal) {
    throw conflict('This journal entry has already been reversed.');
  }

  const no = await nextEntryNo(schoolId);
  const reversingLines = original.lines.map((l) => ({
    accountId: l.accountId,
    description: `Reversal of ${original.no}: ${l.description || ''}`,
    debit: l.credit, // flip credit to debit
    credit: l.debit, // flip debit to credit
  }));

  const resolvedBranchId = original.branchId || (await resolveBranchId(schoolId, null));

  const reversal = await prisma.journalEntry.create({
    data: {
      schoolId,
      branchId: resolvedBranchId,
      no,
      date: new Date(),
      description: `Reversal of ${original.no} — ${original.description}`,
      reference: `REV-${original.no}`,
      status: 'Posted',
      notes: `Reversed from ${original.no}`,
      createdById: auth.id || null,
      createdByName: auth.name || auth.userName || 'System',
      postedAt: new Date(),
      reversedFromId: original.id,
      lines: {
        create: reversingLines,
      },
    },
    include: {
      lines: {
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  logger.info(`Created reversal entry ${reversal.no} for original entry ${original.no}.`);
  return serializeEntry(reversal);
}

/** Delete an entry (allowed only for Drafts). */
async function deleteEntry(schoolId, entryId) {
  const existing = await prisma.journalEntry.findFirst({
    where: { id: entryId, schoolId },
  });
  if (!existing) throw notFound('Journal entry not found.');
  if (existing.status !== 'Draft') {
    throw badRequest('Only Draft journal entries can be deleted.');
  }

  await prisma.journalEntry.delete({ where: { id: entryId } });
  return { id: entryId, deleted: true };
}

module.exports = {
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  postEntry,
  cancelEntry,
  reverseEntry,
  deleteEntry,
  nextEntryNo,
  serializeEntry,
  validateLines,
  loadAccounts,
};
