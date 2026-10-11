/**
 * Ledger engine — the single source of truth for every balance and financial
 * figure in the accounting module.
 *
 * All balances are derived from POSTED journal lines only (never drafts or
 * cancelled entries), which guarantees double-entry integrity:
 *   Assets & Expenses  → debit increases the balance
 *   Liabilities, Equity & Income → credit increases the balance
 *
 * Reports (trial balance, general ledger, P&L, balance sheet, cash & bank) are
 * all computed here so the frontend totals and the backend never disagree.
 */

const prisma = require('../../config/database').prisma;
const { notFound } = require('../../utils/errors');
const { branchWhere } = require('./branch-scope');

const DEBIT_NORMAL_TYPES = new Set(['Asset', 'Expense']);

/** Signed balance of an account: debits minus credits, flipped for credit-normal types. */
function signedBalance(type, debit, credit) {
  return DEBIT_NORMAL_TYPES.has(type) ? debit - credit : credit - debit;
}

/**
 * Aggregate posted journal lines per account, optionally within a date range
 * and/or up to a cutoff date (`asOf`), and optionally one campus.
 * Returns a Map<accountId, {debit, credit}>.
 */
async function aggregateByAccount(schoolId, { from, to, asOf, branchId } = {}) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (asOf) dateFilter.lte = new Date(asOf);
  else if (to) dateFilter.lte = new Date(to);

  // groupBy only accepts relation filters via `is` / `isNot` (not shorthand fields).
  const grouped = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      entry: {
        is: {
          schoolId,
          status: 'Posted',
          ...branchWhere(branchId),
          ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        },
      },
    },
    _sum: { debit: true, credit: true },
  });

  const map = new Map();
  for (const row of grouped) {
    map.set(row.accountId, {
      debit: row._sum.debit || 0,
      credit: row._sum.credit || 0,
    });
  }
  return map;
}

/**
 * Current balance for every account (optionally at a cutoff date).
 * Returns [{ accountId, code, name, type, openingBalance, debit, credit, balance }].
 */
async function accountBalances(schoolId, { asOf, branchId } = {}) {
  const accounts = await prisma.account.findMany({
    where: { schoolId },
    orderBy: { code: 'asc' },
  });

  const totals = await aggregateByAccount(schoolId, { asOf, branchId });

  return accounts.map((account) => {
    const t = totals.get(account.id) || { debit: 0, credit: 0 };
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      openingBalance: account.openingBalance || 0,
      debit: t.debit,
      credit: t.credit,
      balance: (account.openingBalance || 0) + signedBalance(account.type, t.debit, t.credit),
    };
  });
}

/**
 * Trial balance — every account with its net debit/credit movement for the
 * period. The two totals must be equal for the books to be in balance.
 */
async function trialBalance(schoolId, { from, to, branchId } = {}) {
  const accounts = await prisma.account.findMany({
    where: { schoolId },
    orderBy: { code: 'asc' },
  });

  const totals = await aggregateByAccount(schoolId, { from, to, branchId });

  const rows = accounts.map((account) => {
    const t = totals.get(account.id) || { debit: 0, credit: 0 };
    const opening = account.openingBalance || 0;
    // Fold the opening balance into the movement so the report ties to real money.
    let debit = t.debit;
    let credit = t.credit;
    if (opening !== 0) {
      if (DEBIT_NORMAL_TYPES.has(account.type)) {
        if (opening >= 0) debit += opening;
        else credit += -opening;
      } else {
        if (opening >= 0) credit += opening;
        else debit += -opening;
      }
    }
    return {
      code: account.code,
      name: account.name,
      type: account.type,
      debit,
      credit,
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit,
    balanced: totalDebit === totalCredit,
  };
}

/**
 * General ledger for a single account — every posted line in the period with a
 * running balance, preceded by an opening-balance row.
 */
async function generalLedger(schoolId, accountId, { from, to, branchId } = {}) {
  const account = await prisma.account.findFirst({ where: { id: accountId, schoolId } });
  if (!account) throw notFound('Account not found.');

  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const scope = branchWhere(branchId);

  // Opening balance = account's own opening balance + all movement strictly
  // before `from`, so the running balance continues correctly mid-period.
  let opening = account.openingBalance || 0;
  if (from) {
    const prior = await prisma.journalLine.aggregate({
      where: {
        accountId,
        entry: { schoolId, status: 'Posted', ...scope, date: { lt: new Date(from) } },
      },
      _sum: { debit: true, credit: true },
    });
    opening += signedBalance(account.type, prior._sum.debit || 0, prior._sum.credit || 0);
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      entry: {
        schoolId,
        status: 'Posted',
        ...scope,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
    },
    include: { entry: { select: { no: true, date: true, description: true } } },
    orderBy: { entry: { date: 'asc' } },
  });

  let balance = opening;
  const rows = lines.map((line) => {
    balance += signedBalance(account.type, line.debit || 0, line.credit || 0);
    return {
      date: line.entry.date,
      reference: line.entry.no,
      description: line.description || line.entry.description,
      debit: line.debit || 0,
      credit: line.credit || 0,
      balance,
    };
  });

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  return {
    account: { id: account.id, code: account.code, name: account.name, type: account.type },
    opening,
    rows,
    totalDebit,
    totalCredit,
    closing: balance,
  };
}


/**
 * Profit & loss — income vs expenses for the period. Includes an explicit
 * "Current Year Surplus" equity figure so the balance sheet can tie out.
 */
async function profitAndLoss(schoolId, { from, to, branchId } = {}) {
  const tb = await trialBalance(schoolId, { from, to, branchId });

  const income = tb.rows.filter((r) => r.type === 'Income').map((r) => ({
    name: r.name,
    amount: r.credit - r.debit,
  }));
  const expenses = tb.rows.filter((r) => r.type === 'Expense').map((r) => ({
    name: r.name,
    amount: r.debit - r.credit,
  }));

  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  };
}

/**
 * Balance sheet as at a cutoff date. Assets vs Liabilities + Equity + the
 * current-period surplus, which is exactly why it always balances.
 */
async function balanceSheet(schoolId, { asOf, from, to, branchId } = {}) {
  const balances = await accountBalances(schoolId, { asOf, branchId });
  const pl = await profitAndLoss(schoolId, { from, to, branchId });

  const pick = (type) =>
    balances
      .filter((b) => b.type === type && b.balance !== 0)
      .map((b) => ({ name: b.name, amount: b.balance }));

  const assets = pick('Asset');
  const liabilities = pick('Liability');
  let equity = pick('Equity');

  // Current-year surplus rolls into equity (fund) so Assets = Liabilities + Equity.
  if (pl.net !== 0) {
    equity = [...equity, { name: 'Current Year Surplus', amount: pl.net }];
  }

  const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: totalAssets === totalLiabilities + totalEquity,
  };
}


/**
 * Cash-flow statement (indirect, derived from the cash/bank ledgers).
 * Operating = income + working-capital movements (receivables/payables change).
 * Investing = long-term asset movements. Financing = liability + equity
 * movements excluding the current-year surplus.
 */
async function cashFlow(schoolId, { from, to, branchId } = {}) {
  const accounts = await prisma.account.findMany({ where: { schoolId } });

  const openingTotals = await aggregateByAccount(schoolId, {
    to: from ? new Date(from) : undefined,
    branchId,
  });
  const periodTotals = await aggregateByAccount(schoolId, { from, to, branchId });

  const openingBalanceOf = (account) => {
    const t = openingTotals.get(account.id) || { debit: 0, credit: 0 };
    return (account.openingBalance || 0) + signedBalance(account.type, t.debit, t.credit);
  };
  const periodBalanceOf = (account) => {
    const t = periodTotals.get(account.id) || { debit: 0, credit: 0 };
    return (account.openingBalance || 0) + signedBalance(account.type, t.debit, t.credit);
  };

  const cashBank = accounts.filter((a) => a.type === 'Asset' && /cash|bank/i.test(a.name));
  const openingCash = cashBank.reduce((s, a) => s + openingBalanceOf(a), 0);
  const closingCash = cashBank.reduce((s, a) => s + periodBalanceOf(a), 0);

  const operating = [];
  const investing = [];
  const financing = [];

  for (const account of accounts) {
    if (cashBank.includes(account)) continue; // cash movement is the net result, not a line
    const opening = openingBalanceOf(account);
    const closing = periodBalanceOf(account);
    const delta = closing - opening;

    if (account.type === 'Income' || account.type === 'Expense') {
      if (account.type === 'Income' && delta !== 0) operating.push({ name: `Net income — ${account.name}`, amount: delta });
    } else if (account.type === 'Asset') {
      // Working-capital (receivables/inventory) vs long-term (fixed assets).
      if (/receivable|inventory|prepaid|advance/i.test(account.name)) {
        if (delta !== 0) operating.push({ name: `Change in ${account.name}`, amount: -delta });
      } else if (delta !== 0) {
        investing.push({ name: account.name, amount: -delta });
      }
    } else if (account.type === 'Liability') {
      if (/payable|accrued|outstanding/i.test(account.name)) {
        if (delta !== 0) operating.push({ name: `Change in ${account.name}`, amount: delta });
      } else if (delta !== 0) {
        financing.push({ name: account.name, amount: delta });
      }
    } else if (account.type === 'Equity') {
      if (delta !== 0) financing.push({ name: account.name, amount: delta });
    }
  }

  const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
  const netOperating = sum(operating);
  const netInvesting = sum(investing);
  const netFinancing = sum(financing);
  const netTotal = netOperating + netInvesting + netFinancing;

  return {
    opening: openingCash,
    sections: [
      { title: 'Operating Activities', lines: operating, net: netOperating },
      { title: 'Investing Activities', lines: investing, net: netInvesting },
      { title: 'Financing Activities', lines: financing, net: netFinancing },
    ],
    netTotal,
    closing: openingCash + netTotal,
  };
}

/**
 * Cash & bank summary — balances of every cash/bank account, used by the
 * Cash & Bank page. Prefers BankAccount rows (with name + IBAN/number).
 */
async function cashBankSummary(schoolId, { branchId } = {}) {
  // Lazy require avoids circular dependency with bank.service (which uses ledger).
  const bankService = require('./bank.service');
  const accounts = await bankService.listCashBankAccounts(schoolId, { branchId });

  const cash = accounts.filter((a) => a.kind === 'Cash').reduce((s, a) => s + (a.balance || 0), 0);
  const bank = accounts.filter((a) => a.kind === 'Bank').reduce((s, a) => s + (a.balance || 0), 0);

  return { accounts, cash, bank, total: cash + bank };
}

/**
 * Account statement — chronologically ordered list of all income and expense
 * movements with running balances.
 */
async function accountStatement(schoolId, { from, to, type, q, branchId } = {}) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const accountWhere = { schoolId };
  if (type === 'Income') accountWhere.type = 'Income';
  else if (type === 'Expense') accountWhere.type = 'Expense';
  else accountWhere.type = { in: ['Income', 'Expense'] };

  const lines = await prisma.journalLine.findMany({
    where: {
      account: accountWhere,
      entry: {
        schoolId,
        status: 'Posted',
        ...branchWhere(branchId),
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
    },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
      entry: { select: { no: true, date: true, description: true, reference: true } },
    },
    orderBy: { entry: { date: 'asc' } },
  });

  let running = 0;
  const rows = [];
  for (const l of lines) {
    const isIncome = l.account.type === 'Income';
    const amount = isIncome ? (l.credit - l.debit) : (l.debit - l.credit);
    const income = isIncome ? Math.max(0, amount) : 0;
    const expense = !isIncome ? Math.max(0, amount) : 0;
    running += income - expense;

    const row = {
      id: l.id,
      date: l.entry.date ? l.entry.date.toISOString().slice(0, 10) : '',
      ref: l.entry.reference || l.entry.no,
      description: l.description || l.entry.description,
      category: l.account.name,
      type: l.account.type,
      income,
      expense,
      balance: running,
    };

    if (q) {
      const term = q.toLowerCase();
      const match =
        row.description.toLowerCase().includes(term) ||
        row.ref.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term);
      if (!match) continue;
    }

    rows.push(row);
  }

  const totalIn = rows.reduce((s, r) => s + r.income, 0);
  const totalOut = rows.reduce((s, r) => s + r.expense, 0);

  return {
    rows,
    totalIncome: totalIn,
    totalExpense: totalOut,
    net: totalIn - totalOut,
  };
}

module.exports = {
  signedBalance,
  aggregateByAccount,
  accountBalances,
  trialBalance,
  generalLedger,
  profitAndLoss,
  balanceSheet,
  cashFlow,
  cashBankSummary,
  accountStatement,
};

