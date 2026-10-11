/**
 * Cash & Bank & Bank Reconciliation Service.
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { badRequest, notFound } = require('../../utils/errors');
const ledgerService = require('./ledger.service');
const accountService = require('./account.service');
const { branchWhere, resolveBranchId } = require('./branch-scope');

const trimmed = (value) => String(value ?? '').trim();
const toInt = (value) => Math.round(Number(value) || 0);

/** Ensure a default set of Cash and Bank accounts exist for a school. */
async function ensureDefaultBankAccounts(schoolId) {
  const count = await prisma.bankAccount.count({ where: { schoolId } });
  if (count > 0) return;

  await accountService.ensureDefaultChartOfAccounts(schoolId);

  const cashAcc = await prisma.account.findFirst({ where: { schoolId, code: '1001' } });
  const bankAcc = await prisma.account.findFirst({ where: { schoolId, code: '1002' } });

  if (cashAcc) {
    await prisma.bankAccount.create({
      data: {
        schoolId,
        name: 'Petty Cash',
        number: '—',
        kind: 'Cash',
        accountId: cashAcc.id,
      },
    }).catch(() => {});
  }

  if (bankAcc) {
    await prisma.bankAccount.create({
      data: {
        schoolId,
        name: 'Main Operating Bank',
        number: 'PK36-SCB-0001-2233',
        kind: 'Bank',
        accountId: bankAcc.id,
      },
    }).catch(() => {});
  }
}

/** List all cash and bank accounts with live derived balances. */
async function listCashBankAccounts(schoolId, { branchId } = {}) {
  await ensureDefaultBankAccounts(schoolId);

  const bankAccounts = await prisma.bankAccount.findMany({
    where: {
      schoolId,
      // Campus filter: show campus-tagged accounts + school-wide (null) defaults
      ...(branchId && branchId !== 'all'
        ? { OR: [{ branchId }, { branchId: null }] }
        : {}),
    },
    include: { account: true },
    orderBy: { createdAt: 'asc' },
  });

  const totals = await ledgerService.aggregateByAccount(schoolId, { branchId });

  return bankAccounts.map((b) => {
    const t = totals.get(b.accountId) || { debit: 0, credit: 0 };
    const opening = b.account ? b.account.openingBalance || 0 : 0;
    const balance = opening + (t.debit - t.credit);
    return {
      id: b.id,
      branchId: b.branchId || null,
      name: b.name,
      number: b.number || '—',
      kind: b.kind,
      isActive: b.isActive,
      accountId: b.accountId,
      accountCode: b.account ? b.account.code : '',
      balance,
    };
  });
}

/** Create a new cash or bank account. */
async function createBankAccount(schoolId, input) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Account name is required.');

  const kind = trimmed(input.kind) === 'Cash' ? 'Cash' : 'Bank';
  const number = trimmed(input.number) || '—';

  let accountId = trimmed(input.accountId);
  if (!accountId) {
    // Create underlying ledger account
    const count = await prisma.account.count({ where: { schoolId } });
    const code = String(1010 + count);
    const acc = await prisma.account.create({
      data: {
        schoolId,
        code,
        name,
        type: 'Asset',
        parent: 'Current Assets',
        isActive: true,
        openingBalance: toInt(input.openingBalance),
      },
    });
    accountId = acc.id;
  }

  const resolvedBranchId = await resolveBranchId(schoolId, input.branchId);

  const b = await prisma.bankAccount.create({
    data: {
      schoolId,
      branchId: resolvedBranchId,
      name,
      number,
      kind,
      accountId,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    },
    include: { account: true },
  });

  const balance = (b.account?.openingBalance || 0);
  return {
    id: b.id,
    branchId: b.branchId || null,
    name: b.name,
    number: b.number,
    kind: b.kind,
    isActive: b.isActive,
    accountId: b.accountId,
    accountCode: b.account?.code || '',
    balance,
  };
}

/** List bank transactions for reconciliation. */
async function listBankTransactions(schoolId, { bankAccountId, status, from, to, branchId } = {}) {
  const where = { schoolId, ...branchWhere(branchId) };
  if (bankAccountId) where.bankAccountId = bankAccountId;
  if (status) where.status = status;

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const txns = await prisma.bankTransaction.findMany({
    where,
    include: {
      bankAccount: { select: { name: true, kind: true } },
    },
    orderBy: { date: 'desc' },
  });

  return txns.map((t) => ({
    id: t.id,
    bankAccountId: t.bankAccountId,
    bankAccountName: t.bankAccount ? t.bankAccount.name : '',
    date: t.date ? t.date.toISOString().slice(0, 10) : '',
    reference: t.reference || '',
    description: t.description || '',
    book: t.bookAmount || 0,
    bank: t.bankAmount || 0,
    status: t.status,
  }));
}

/** Create a bank reconciliation transaction. */
async function createBankTransaction(schoolId, input) {
  const bankAccountId = trimmed(input.bankAccountId);
  if (!bankAccountId) throw badRequest('Bank account is required.');

  const date = input.date ? new Date(input.date) : new Date();
  const reference = trimmed(input.reference);
  const description = trimmed(input.description);
  const bookAmount = toInt(input.bookAmount || input.book);
  const bankAmount = toInt(input.bankAmount || input.bank);
  const status = trimmed(input.status) === 'Matched' ? 'Matched' : 'Unmatched';

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, schoolId },
  });
  if (!bankAccount) throw notFound('Bank account not found.');

  const resolvedBranchId =
    bankAccount.branchId || (await resolveBranchId(schoolId, input.branchId));

  const row = await prisma.bankTransaction.create({
    data: {
      schoolId,
      branchId: resolvedBranchId,
      bankAccountId,
      date,
      reference,
      description,
      bookAmount,
      bankAmount,
      status,
    },
  });

  return {
    id: row.id,
    branchId: row.branchId || null,
    bankAccountId: row.bankAccountId,
    date: row.date.toISOString().slice(0, 10),
    reference: row.reference,
    description: row.description,
    book: row.bookAmount,
    bank: row.bankAmount,
    status: row.status,
  };
}

/** Toggle or set match status of a bank transaction. */
async function updateBankTransactionStatus(schoolId, id, status) {
  const existing = await prisma.bankTransaction.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Bank transaction not found.');

  const newStatus = status ? trimmed(status) : (existing.status === 'Matched' ? 'Unmatched' : 'Matched');
  const updated = await prisma.bankTransaction.update({
    where: { id },
    data: { status: newStatus },
  });

  return {
    id: updated.id,
    status: updated.status,
  };
}

/** Mark all unmatched transactions as matched. */
async function markAllMatched(schoolId, bankAccountId) {
  const where = { schoolId, status: 'Unmatched' };
  if (bankAccountId) where.bankAccountId = bankAccountId;

  const result = await prisma.bankTransaction.updateMany({
    where,
    data: { status: 'Matched' },
  });

  return { matchedCount: result.count };
}

/** Reconciliation summary for an account. */
async function getReconciliationSummary(schoolId, { bankAccountId, branchId } = {}) {
  const accounts = await listCashBankAccounts(schoolId, { branchId });
  const selected = bankAccountId ? accounts.find((a) => a.id === bankAccountId) : accounts[0];

  const bookBalance = selected ? selected.balance : 0;
  const txns = await listBankTransactions(schoolId, {
    bankAccountId: selected?.id,
    branchId,
  });

  const matched = txns.filter((t) => t.status === 'Matched');
  const unmatched = txns.filter((t) => t.status === 'Unmatched');

  const matchedBook = matched.reduce((s, t) => s + t.book, 0);
  const matchedBank = matched.reduce((s, t) => s + t.bank, 0);

  const unmatchedBook = unmatched.reduce((s, t) => s + t.book, 0);
  const unmatchedBank = unmatched.reduce((s, t) => s + t.bank, 0);

  return {
    account: selected,
    bookBalance,
    statementBalance: bookBalance + unmatchedBank - unmatchedBook,
    difference: unmatchedBank - unmatchedBook,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    txns,
  };
}

module.exports = {
  listCashBankAccounts,
  createBankAccount,
  listBankTransactions,
  createBankTransaction,
  updateBankTransactionStatus,
  markAllMatched,
  getReconciliationSummary,
};
