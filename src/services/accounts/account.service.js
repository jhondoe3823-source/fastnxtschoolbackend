/**
 * Chart of Accounts service.
 *
 * Every account belongs to a school (tenant isolation) and is one of the five
 * standard accounting types. Accounts are never hard-deleted once referenced by
 * a journal line/voucher — they are deactivated instead, which keeps historical
 * reports intact.
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { conflict, notFound, badRequest } = require('../../utils/errors');
const { ERROR_CODES } = require('../../constants');
const ledger = require('./ledger.service');

const VALID_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const ACCOUNT_FIELDS = [
  'id',
  'schoolId',
  'code',
  'name',
  'type',
  'parent',
  'isActive',
  'isSystem',
  'openingBalance',
  'createdAt',
  'updatedAt',
];

const trimmed = (value) => String(value ?? '').trim();

/** The canonical account payload (with its live balance). */
async function serializeAccount(account) {
  if (!account) return null;

  const totals = await ledger.aggregateByAccount(account.schoolId);
  const t = totals.get(account.id) || { debit: 0, credit: 0 };
  const balance = (account.openingBalance || 0) + ledger.signedBalance(account.type, t.debit, t.credit);

  const payload = { id: account.id, balance };
  for (const field of ACCOUNT_FIELDS) {
    if (field === 'id') continue;
    const value = account[field];
    payload[field] = value === undefined ? null : value;
  }
  return payload;
}

/** List accounts for a school, optionally filtered by type/status, with balances. */
async function listAccounts(schoolId, { type, status } = {}) {
  const where = { schoolId };
  if (type) where.type = type;
  if (status === 'Active') where.isActive = true;
  if (status === 'Inactive') where.isActive = false;

  const accounts = await prisma.account.findMany({
    where,
    orderBy: { code: 'asc' },
  });

  const totals = await ledger.aggregateByAccount(schoolId);

  return accounts.map((account) => {
    const t = totals.get(account.id) || { debit: 0, credit: 0 };
    return {
      id: account.id,
      schoolId: account.schoolId,
      code: account.code,
      name: account.name,
      type: account.type,
      parent: account.parent || '',
      status: account.isActive ? 'Active' : 'Inactive',
      isActive: account.isActive,
      isSystem: account.isSystem,
      openingBalance: account.openingBalance || 0,
      balance: (account.openingBalance || 0) + ledger.signedBalance(account.type, t.debit, t.credit),
    };
  });
}

/** Get a single account (must belong to the school). */
async function getAccount(schoolId, accountId) {
  const account = await prisma.account.findFirst({ where: { id: accountId, schoolId } });
  if (!account) throw notFound('Account not found.');
  return serializeAccount(account);
}

/** Create a new account. */
async function createAccount(schoolId, input) {
  const code = trimmed(input.code);
  const name = trimmed(input.name);
  const type = trimmed(input.type);

  if (!VALID_TYPES.includes(type)) {
    throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const existing = await prisma.account.findFirst({ where: { schoolId, code } });
  if (existing) {
    throw conflict('An account with this code already exists.', ERROR_CODES.CODE_IN_USE);
  }

  const account = await prisma.account.create({
    data: {
      schoolId,
      code,
      name,
      type,
      parent: trimmed(input.parent) || '',
      isActive: input.status ? input.status === 'Active' : true,
      openingBalance: Number(input.openingBalance) || 0,
    },
  });

  logger.info(`Created account "${account.name}" (${account.code}) for school ${schoolId}.`);
  return serializeAccount(account);
}

/** Update an account (partial). */
async function updateAccount(schoolId, accountId, input) {
  const account = await prisma.account.findFirst({ where: { id: accountId, schoolId } });
  if (!account) throw notFound('Account not found.');

  if (input.type !== undefined && !VALID_TYPES.includes(input.type)) {
    throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const data = {};
  if (input.code !== undefined) data.code = trimmed(input.code).toUpperCase();
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.type !== undefined) data.type = input.type;
  if (input.parent !== undefined) data.parent = trimmed(input.parent) || '';
  if (input.status !== undefined) data.isActive = input.status === 'Active';
  if (input.openingBalance !== undefined) data.openingBalance = Number(input.openingBalance) || 0;

  // Code uniqueness within the school (if being changed).
  if (data.code && data.code !== account.code) {
    const taken = await prisma.account.findFirst({ where: { schoolId, code: data.code } });
    if (taken && taken.id !== accountId) {
      throw conflict('An account with this code already exists.', ERROR_CODES.CODE_IN_USE);
    }
  }

  if (Object.keys(data).length === 0) return serializeAccount(account);

  const updated = await prisma.account.update({ where: { id: accountId }, data });
  logger.info(`Updated account "${updated.name}" (${updated.id}).`);
  return serializeAccount(updated);
}

/**
 * Delete an account. Blocked when the account has posted movements or is a
 * system account; otherwise the row is removed.
 */
async function deleteAccount(schoolId, accountId) {
  const account = await prisma.account.findFirst({ where: { id: accountId, schoolId } });
  if (!account) throw notFound('Account not found.');

  if (account.isSystem) {
    throw badRequest('System accounts cannot be deleted.');
  }

  const lineCount = await prisma.journalLine.count({ where: { accountId } });
  if (lineCount > 0) {
    throw conflict('This account has posted transactions. Deactivate it instead of deleting.');
  }

  const referenced = await Promise.all([
    prisma.voucher.count({ where: { accountId } }),
    prisma.invoice.count({ where: { accountId } }),
    prisma.bankAccount.count({ where: { accountId } }),
  ]);
  if (referenced.some((c) => c > 0)) {
    throw conflict('This account is referenced by vouchers, invoices or bank accounts and cannot be deleted.');
  }

  await prisma.account.delete({ where: { id: accountId } });
  logger.info(`Deleted account "${account.name}" (${accountId}).`);
}


/**
 * Ensure a school has a default chart of accounts. Called the first time the
 * accounting module is opened. Idempotent: does nothing when accounts exist.
 */
const DEFAULT_ACCOUNTS = [
  { code: '1001', name: 'Cash', type: 'Asset', parent: 'Current Assets' },
  { code: '1002', name: 'Bank Account', type: 'Asset', parent: 'Current Assets' },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', parent: 'Current Assets' },
  { code: '1101', name: 'Inventory Stock', type: 'Asset', parent: 'Current Assets' },
  { code: '1200', name: 'Fixed Assets', type: 'Asset', parent: 'Non-current Assets' },
  { code: '2001', name: 'Accounts Payable', type: 'Liability', parent: 'Current Liabilities' },
  { code: '2002', name: 'Salaries Payable', type: 'Liability', parent: 'Current Liabilities' },
  { code: '3001', name: 'Opening Fund', type: 'Equity', parent: 'School Fund' },
  { code: '3002', name: 'Retained Surplus', type: 'Equity', parent: 'School Fund' },
  { code: '4001', name: 'Tuition Fees', type: 'Income', parent: 'Fee Income' },
  { code: '4002', name: 'Admission Fees', type: 'Income', parent: 'Fee Income' },
  { code: '4003', name: 'Transport Fees', type: 'Income', parent: 'Fee Income' },
  { code: '4004', name: 'Other Income', type: 'Income', parent: 'Fee Income' },
  { code: '5001', name: 'Salaries', type: 'Expense', parent: 'Operating Expenses' },
  { code: '5002', name: 'Rent', type: 'Expense', parent: 'Operating Expenses' },
  { code: '5003', name: 'Utilities', type: 'Expense', parent: 'Operating Expenses' },
  { code: '5004', name: 'Stationery', type: 'Expense', parent: 'Operating Expenses' },
  { code: '5005', name: 'Maintenance', type: 'Expense', parent: 'Operating Expenses' },
  { code: '5006', name: 'Transport', type: 'Expense', parent: 'Operating Expenses' },
  { code: '5007', name: 'Other Expenses', type: 'Expense', parent: 'Operating Expenses' },
];

/**
 * Ensure default ledger accounts exist. Idempotent: only inserts missing codes
 * so existing schools still receive new system accounts (e.g. Inventory Stock).
 */
async function ensureDefaultChartOfAccounts(schoolId) {
  const existing = await prisma.account.findMany({
    where: { schoolId },
    select: { code: true },
  });
  const have = new Set(existing.map((a) => a.code));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !have.has(a.code));
  if (missing.length === 0) return;

  await prisma.account.createMany({
    data: missing.map((a) => ({ ...a, schoolId, isSystem: true })),
    skipDuplicates: true,
  });
  logger.info(`Seeded ${missing.length} chart-of-accounts row(s) for school ${schoolId}.`);
}

/** Resolve a ledger account by preferred code, then by name. */
async function findAccountByCodeOrName(schoolId, { code, name } = {}) {
  await ensureDefaultChartOfAccounts(schoolId);
  if (code) {
    const byCode = await prisma.account.findFirst({
      where: { schoolId, code, isActive: true },
    });
    if (byCode) return byCode;
  }
  if (name) {
    const byName = await prisma.account.findFirst({
      where: { schoolId, name, isActive: true },
    });
    if (byName) return byName;
  }
  return null;
}

module.exports = {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  ensureDefaultChartOfAccounts,
  findAccountByCodeOrName,
  serializeAccount,
  VALID_TYPES,
};

