

const { DEBIT_NORMAL_TYPES, ACCOUNT_TYPES } = require('../../constants');

const toInt = (value) => {
  const n = Math.round(Number(value) || 0);
  return Number.isFinite(n) ? n : 0;
};

const isDebitNormal = (type) => DEBIT_NORMAL_TYPES.includes(type);

/** Sum of debit and credit across a set of lines (integer units). */
function sumLines(lines = []) {
  return lines.reduce(
    (acc, line) => {
      acc.debit += toInt(line.debit);
      acc.credit += toInt(line.credit);
      return acc;
    },
    { debit: 0, credit: 0 }
  );
}

/** A set of lines balances when total debits equal total credits. */
function isBalanced(lines = []) {
  const { debit, credit } = sumLines(lines);
  return debit === credit;
}

/**
 * Net (signed) balance of a single account in its own natural unit:
 *   debit-normal  -> debits - credits
 *   credit-normal -> credits - debits
 * `opening` is the account's opening balance in the same natural unit.
 */
function netBalance(type, opening, lines = []) {
  const { debit, credit } = sumLines(lines);
  const movement = isDebitNormal(type) ? debit - credit : credit - debit;
  return toInt(opening) + movement;
}

/**
 * Closing debit/credit presentation of an account for a trial balance:
 * whichever side the net balance lands on becomes non-zero.
 */
function closingSides(type, opening, lines = []) {
  const net = netBalance(type, opening, lines);
  if (isDebitNormal(type)) {
    return net >= 0 ? { debit: net, credit: 0 } : { debit: 0, credit: -net };
  }
  return net >= 0 ? { debit: 0, credit: net } : { debit: -net, credit: 0 };
}

/** Group posted lines by accountId into a Map for report math. */
function groupByAccount(lines = []) {
  const map = new Map();
  for (const line of lines) {
    const arr = map.get(line.accountId) || [];
    arr.push(line);
    map.set(line.accountId, arr);
  }
  return map;
}

/**
 * Trial balance keyed by account.
 *   accounts -> [{ id, code, name, type, openingBalance }]
 *   lines    -> [{ accountId, debit, credit }] (POSTED only)
 */
function trialBalance(accounts = [], lines = []) {
  const byAccount = groupByAccount(lines);
  let totalDebit = 0;
  let totalCredit = 0;

  const rows = accounts.map((account) => {
    const { debit, credit } = closingSides(account.type, account.openingBalance, byAccount.get(account.id) || []);
    totalDebit += debit;
    totalCredit += credit;
    return { accountId: account.id, code: account.code, name: account.name, type: account.type, debit, credit };
  });

  rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

/**
 * Income & expense totals for the P&L. Only POSTED lines belong here. Income
 * and expense accounts have no opening balance in this module (opening is 0).
 */
function profitAndLoss(accounts = [], lines = []) {
  const { INCOME, EXPENSE } = ACCOUNT_TYPES;
  const byAccount = groupByAccount(lines);
  const income = [];
  const expenses = [];

  for (const account of accounts) {
    const accLines = byAccount.get(account.id) || [];
    if (accLines.length === 0) continue;
    const net = netBalance(account.type, account.openingBalance, accLines);
    const row = { accountId: account.id, code: account.code, name: account.name, amount: net };
    if (account.type === INCOME) income.push(row);
    else if (account.type === EXPENSE) expenses.push(row);
  }

  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
  return { income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}

/**
 * Balance sheet as at a point in time. Assets on one side; liabilities, equity
 * and the period net surplus (income - expense, folded into equity) on the
 * other. Balances by construction when the underlying entries are balanced.
 */
function balanceSheet(accounts = [], lines = []) {
  const { ASSET, LIABILITY, EQUITY, INCOME, EXPENSE } = ACCOUNT_TYPES;
  const byAccount = groupByAccount(lines);
  const assets = [];
  const liabilities = [];
  const equity = [];
  let retained = 0; // current-period income - expenses

  for (const account of accounts) {
    const net = netBalance(account.type, account.openingBalance, byAccount.get(account.id) || []);
    const row = { accountId: account.id, code: account.code, name: account.name, amount: net };
    if (account.type === ASSET) {
      if (net !== 0) assets.push(row);
    } else if (account.type === LIABILITY) {
      if (net !== 0) liabilities.push(row);
    } else if (account.type === EQUITY) {
      if (net !== 0) equity.push(row);
    } else if (account.type === INCOME) {
      retained += net;
    } else if (account.type === EXPENSE) {
      retained -= net;
    }
  }

  if (retained !== 0) {
    equity.push({ accountId: null, code: '', name: 'Current Year Surplus', amount: retained });
  }

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0);

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
 * General-ledger running statement for one account, in chronological order.
 *   account -> { id, name, type, openingBalance }
 *   lines   -> [{ date, reference, description, debit, credit }] (POSTED)
 */
function generalLedger(account, lines = []) {
  const ordered = [...lines].sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = toInt(account.openingBalance);

  const rows = ordered.map((line) => {
    const debit = toInt(line.debit);
    const credit = toInt(line.credit);
    running += isDebitNormal(account.type) ? debit - credit : credit - debit;
    return {
      date: line.date,
      reference: line.reference || '',
      description: line.description || '',
      debit: debit || null,
      credit: credit || null,
      balance: running,
    };
  });

  const totalDebit = ordered.reduce((s, l) => s + toInt(l.debit), 0);
  const totalCredit = ordered.reduce((s, l) => s + toInt(l.credit), 0);

  return { account, opening: toInt(account.openingBalance), rows, totalDebit, totalCredit, closing: running };
}


module.exports = {
  toInt,
  isDebitNormal,
  sumLines,
  isBalanced,
  netBalance,
  closingSides,
  trialBalance,
  profitAndLoss,
  balanceSheet,
  generalLedger,
};
