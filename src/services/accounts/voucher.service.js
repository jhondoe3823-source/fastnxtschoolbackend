/**
 * Voucher Service — Receipt & Payment Vouchers.
 *
 * Every posted voucher automatically creates and posts a balanced Journal Entry:
 *   - Receipt Voucher:
 *       Debit: Cash / Bank Account (Asset increases)
 *       Credit: Target Account (e.g. Tuition Fees / Income or Accounts Receivable)
 *
 *   - Payment Voucher:
 *       Debit: Target Account (e.g. Salaries / Rent / Operating Expense)
 *       Credit: Cash / Bank Account (Asset decreases)
 *
 * This ensures that vouchers immediately reflect in the Trial Balance, P&L,
 * Balance Sheet, General Ledger, and Cash & Bank balances.
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { badRequest, notFound, conflict } = require('../../utils/errors');
const journalService = require('./journal.service');
const accountService = require('./account.service');
const { branchWhere, resolveBranchId } = require('./branch-scope');

const trimmed = (value) => String(value ?? '').trim();
const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));

/** Next sequential voucher number, e.g. RV-0001 or PV-0001. */
async function nextVoucherNo(schoolId, kind) {
  const prefix = kind === 'Receipt' ? 'RV' : 'PV';
  const last = await prisma.voucher.findFirst({
    where: { schoolId, kind },
    orderBy: { no: 'desc' },
    select: { no: true },
  });
  const seq = last ? Number(String(last.no).replace(/\D/g, '')) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Locate the appropriate Cash or Bank ledger account for a voucher payment method.
 * `preferredId` may be either a BankAccount.id or a Chart-of-Accounts Account.id.
 */
async function resolveCashBankAccount(schoolId, method, preferredId) {
  if (preferredId) {
    const bankRow = await prisma.bankAccount.findFirst({
      where: { id: preferredId, schoolId, isActive: true },
      include: { account: true },
    });
    if (bankRow?.account) return bankRow.account;

    const acc = await prisma.account.findFirst({
      where: { id: preferredId, schoolId, isActive: true },
    });
    if (acc) return acc;
  }

  // Ensure default accounts exist
  await accountService.ensureDefaultChartOfAccounts(schoolId);

  const isCash = method === 'Cash';
  if (isCash) {
    let cashAcc = await prisma.account.findFirst({
      where: { schoolId, code: '1001', isActive: true },
    });
    if (!cashAcc) {
      cashAcc = await prisma.account.findFirst({
        where: { schoolId, type: 'Asset', name: { contains: 'Cash', mode: 'insensitive' }, isActive: true },
      });
    }
    return cashAcc;
  }

  let bankAcc = await prisma.account.findFirst({
    where: { schoolId, code: '1002', isActive: true },
  });
  if (!bankAcc) {
    bankAcc = await prisma.account.findFirst({
      where: { schoolId, type: 'Asset', name: { contains: 'Bank', mode: 'insensitive' }, isActive: true },
    });
  }
  return bankAcc;
}

/** Enrich vouchers with cash/bank account display names (from BankAccount metadata when available). */
async function attachCashBankLabels(schoolId, vouchers) {
  const ids = [...new Set(vouchers.map((v) => v.cashBankAccountId).filter(Boolean))];
  if (ids.length === 0) {
    return vouchers.map((v) => ({ ...v, cashBankAccount: '', cashBankAccountNumber: '' }));
  }

  const [bankRows, ledgerRows] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { schoolId, OR: [{ id: { in: ids } }, { accountId: { in: ids } }] },
      select: { id: true, accountId: true, name: true, number: true, kind: true },
    }),
    prisma.account.findMany({
      where: { schoolId, id: { in: ids } },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const byAnyId = new Map();
  for (const b of bankRows) {
    const label = { name: b.name, number: b.number || '', kind: b.kind };
    byAnyId.set(b.id, label);
    byAnyId.set(b.accountId, label);
  }
  for (const a of ledgerRows) {
    if (!byAnyId.has(a.id)) {
      byAnyId.set(a.id, { name: a.name, number: '', kind: /cash/i.test(a.name) ? 'Cash' : 'Bank' });
    }
  }

  return vouchers.map((v) => {
    const meta = v.cashBankAccountId ? byAnyId.get(v.cashBankAccountId) : null;
    return {
      ...v,
      cashBankAccount: meta?.name || '',
      cashBankAccountNumber: meta?.number || '',
    };
  });
}

/** Create and post the linked journal entry for a voucher. */
async function createVoucherJournalEntry(schoolId, voucher, cashBankAcc, auth = {}) {
  const jeNo = await journalService.nextEntryNo(schoolId);
  const amount = toInt(voucher.amount);

  let lines = [];
  if (voucher.kind === 'Receipt') {
    // Debit Cash/Bank, Credit target Account
    lines = [
      {
        accountId: cashBankAcc.id,
        description: `Receipt from ${voucher.party} (${voucher.no})`,
        debit: amount,
        credit: 0,
      },
      {
        accountId: voucher.accountId,
        description: `Receipt for ${voucher.party} (${voucher.no})`,
        debit: 0,
        credit: amount,
      },
    ];
  } else {
    // Payment: Debit target Account (Expense/Liability), Credit Cash/Bank
    lines = [
      {
        accountId: voucher.accountId,
        description: `Payment to ${voucher.party} (${voucher.no})`,
        debit: amount,
        credit: 0,
      },
      {
        accountId: cashBankAcc.id,
        description: `Payment to ${voucher.party} (${voucher.no})`,
        debit: 0,
        credit: amount,
      },
    ];
  }

  const entry = await prisma.journalEntry.create({
    data: {
      schoolId,
      branchId: voucher.branchId || null,
      no: jeNo,
      date: voucher.date,
      description: `${voucher.kind} Voucher ${voucher.no}: ${voucher.party}`,
      reference: voucher.reference || voucher.no,
      status: 'Posted',
      notes: `Generated by ${voucher.kind} Voucher ${voucher.no}`,
      createdById: auth.id || null,
      createdByName: auth.name || auth.userName || 'System',
      postedAt: new Date(),
      lines: {
        create: lines,
      },
    },
  });

  return entry;
}

/** Serialize voucher for frontend. */
function serializeVoucher(voucher) {
  if (!voucher) return null;
  return {
    id: voucher.id,
    no: voucher.no,
    branchId: voucher.branchId || null,
    kind: voucher.kind,
    date: voucher.date ? voucher.date.toISOString().slice(0, 10) : '',
    party: voucher.party,
    accountId: voucher.accountId,
    account: voucher.account ? voucher.account.name : voucher.accountId,
    accountCode: voucher.account ? voucher.account.code : '',
    accountType: voucher.account ? voucher.account.type : '',
    amount: voucher.amount || 0,
    method: voucher.method || 'Cash',
    cashBankAccountId: voucher.cashBankAccountId || null,
    cashBankAccount: voucher.cashBankAccount || '',
    cashBankAccountNumber: voucher.cashBankAccountNumber || '',
    reference: voucher.reference || '',
    status: voucher.status,
    journalEntryId: voucher.journalEntryId || null,
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
  };
}

/** List vouchers with optional filters. */
async function listVouchers(schoolId, { kind, status, accountId, from, to, q, branchId } = {}) {
  const where = { schoolId, ...branchWhere(branchId) };
  if (kind) where.kind = kind;
  if (status) where.status = status;
  if (accountId) where.accountId = accountId;

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  if (q) {
    const term = trimmed(q);
    where.OR = [
      { no: { contains: term, mode: 'insensitive' } },
      { party: { contains: term, mode: 'insensitive' } },
      { reference: { contains: term, mode: 'insensitive' } },
    ];
  }

  const vouchers = await prisma.voucher.findMany({
    where,
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { date: 'desc' },
  });

  const enriched = await attachCashBankLabels(schoolId, vouchers);
  return enriched.map(serializeVoucher);
}

/** Get a single voucher by ID. */
async function getVoucher(schoolId, voucherId) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, schoolId },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
  });
  if (!voucher) throw notFound('Voucher not found.');
  const [enriched] = await attachCashBankLabels(schoolId, [voucher]);
  return serializeVoucher(enriched);
}

/** Create a new voucher. Automatically posts journal entry if status is 'Posted'. */
async function createVoucher(schoolId, input, auth = {}) {
  const kind = trimmed(input.kind) === 'Payment' ? 'Payment' : 'Receipt';
  const party = trimmed(input.party);
  if (!party) throw badRequest('Party name is required.');

  const amount = toInt(input.amount);
  if (amount <= 0) throw badRequest('Voucher amount must be greater than zero.');

  const date = input.date ? new Date(input.date) : new Date();
  const method = trimmed(input.method) || 'Cash';
  const reference = trimmed(input.reference);
  const status = trimmed(input.status) === 'Draft' ? 'Draft' : 'Posted'; // default to Posted for immediate impact

  // Validate or find the account
  let accountId = trimmed(input.accountId);
  if (!accountId && input.account) {
    const acc = await prisma.account.findFirst({
      where: { schoolId, name: trimmed(input.account), isActive: true },
    });
    if (acc) accountId = acc.id;
  }

  if (!accountId) {
    // If not given, pick a reasonable default
    await accountService.ensureDefaultChartOfAccounts(schoolId);
    const defaultCode = kind === 'Receipt' ? '4001' : '5007'; // Tuition Fees or Other Expense
    const defAcc = await prisma.account.findFirst({ where: { schoolId, code: defaultCode } });
    if (defAcc) accountId = defAcc.id;
    else throw badRequest('Account is required.');
  }

  const targetAccount = await prisma.account.findFirst({ where: { id: accountId, schoolId } });
  if (!targetAccount) throw notFound('Target account not found.');

  const no = trimmed(input.no) || (await nextVoucherNo(schoolId, kind));
  const resolvedBranchId = await resolveBranchId(schoolId, input.branchId);

  // Resolve which Cash/Bank ledger account this voucher touches (required for Posted).
  const preferredCashBankId = trimmed(input.cashBankAccountId) || null;
  let cashBankAcc = null;
  if (status === 'Posted' || preferredCashBankId) {
    cashBankAcc = await resolveCashBankAccount(schoolId, method, preferredCashBankId);
    if (status === 'Posted' && !cashBankAcc) {
      throw badRequest('Could not resolve a Cash or Bank account. Please select one.');
    }
  }

  let journalEntryId = null;
  if (status === 'Posted') {
    const tempVoucher = { no, kind, date, party, accountId, amount, reference, branchId: resolvedBranchId };
    const je = await createVoucherJournalEntry(schoolId, tempVoucher, cashBankAcc, auth);
    journalEntryId = je.id;
  }

  const voucher = await prisma.voucher.create({
    data: {
      schoolId,
      branchId: resolvedBranchId,
      no,
      kind,
      date,
      party,
      accountId,
      amount,
      method,
      cashBankAccountId: cashBankAcc?.id || preferredCashBankId || null,
      reference,
      status,
      journalEntryId,
    },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
  });

  logger.info(`Created ${kind} Voucher ${voucher.no} (${status}) for school ${schoolId}.`);
  const [enriched] = await attachCashBankLabels(schoolId, [voucher]);
  return serializeVoucher(enriched);
}

/** Post an existing draft voucher. */
async function postVoucher(schoolId, voucherId, auth = {}) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, schoolId },
    include: { account: true },
  });
  if (!voucher) throw notFound('Voucher not found.');
  if (voucher.status === 'Posted') return serializeVoucher(voucher);
  if (voucher.status === 'Cancelled') throw badRequest('Cancelled vouchers cannot be posted.');

  const cashBankAcc = await resolveCashBankAccount(schoolId, voucher.method, voucher.cashBankAccountId);
  if (!cashBankAcc) throw badRequest('Could not resolve Cash or Bank account. Please select one.');

  const je = await createVoucherJournalEntry(schoolId, voucher, cashBankAcc, auth);

  const updated = await prisma.voucher.update({
    where: { id: voucherId },
    data: {
      status: 'Posted',
      journalEntryId: je.id,
      cashBankAccountId: voucher.cashBankAccountId || cashBankAcc.id,
    },
    include: { account: true },
  });

  logger.info(`Posted voucher ${updated.no} for school ${schoolId}.`);
  const [enriched] = await attachCashBankLabels(schoolId, [updated]);
  return serializeVoucher(enriched);
}

/** Cancel a voucher. If posted, also cancels the associated journal entry. */
async function cancelVoucher(schoolId, voucherId, auth = {}) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, schoolId },
    include: { account: true },
  });
  if (!voucher) throw notFound('Voucher not found.');
  if (voucher.status === 'Cancelled') return serializeVoucher(voucher);

  if (voucher.journalEntryId) {
    try {
      await journalService.cancelEntry(schoolId, voucher.journalEntryId, auth);
    } catch (e) {
      logger.warn(`Could not cancel journal entry ${voucher.journalEntryId} for voucher ${voucher.no}: ${e.message}`);
    }
  }

  const updated = await prisma.voucher.update({
    where: { id: voucherId },
    data: { status: 'Cancelled' },
    include: { account: true },
  });

  logger.info(`Cancelled voucher ${updated.no} for school ${schoolId}.`);
  return serializeVoucher(updated);
}

/** Delete a draft voucher. */
async function deleteVoucher(schoolId, voucherId) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, schoolId },
  });
  if (!voucher) throw notFound('Voucher not found.');
  if (voucher.status === 'Posted') {
    throw badRequest('Posted vouchers cannot be deleted. Cancel instead.');
  }

  await prisma.voucher.delete({ where: { id: voucherId } });
  return { id: voucherId, deleted: true };
}

module.exports = {
  listVouchers,
  getVoucher,
  createVoucher,
  postVoucher,
  cancelVoucher,
  deleteVoucher,
  nextVoucherNo,
  resolveCashBankAccount,
};
