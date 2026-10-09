/**
 * Accounting vocabulary.
 *
 * These strings mirror the columns in `prisma/schema.prisma` (the accounting
 * models use free strings rather than enums so account types / statuses can be
 * extended without a migration). Services, validators and controllers all read
 * from here so the allowed values live in exactly one place.
 */

/** The five standard ledger classes. Drives debit/credit sign conventions. */
const ACCOUNT_TYPES = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expense',
};

const ACCOUNT_TYPES_LIST = [
  ACCOUNT_TYPES.ASSET,
  ACCOUNT_TYPES.LIABILITY,
  ACCOUNT_TYPES.EQUITY,
  ACCOUNT_TYPES.INCOME,
  ACCOUNT_TYPES.EXPENSE,
];

/** Journal entry lifecycle. */
const ENTRY_STATUS = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
};

/** Voucher lifecycle (receipt / payment vouchers). */
const VOUCHER_STATUS = ENTRY_STATUS;

/** Voucher kind → which contra (cash/bank) leg it touches. */
const VOUCHER_KIND = {
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
};

/** Supported payment methods for vouchers. */
const PAY_METHODS = ['Cash', 'Bank', 'Cheque', 'Online'];

/** Invoice (fee receivable) lifecycle. */
const INVOICE_STATUS = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
};

/** Budget lifecycle. */
const BUDGET_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  COMPLETED: 'Completed',
  OVER_BUDGET: 'Over Budget',
};

/** Bank reconciliation line match state. */
const BANK_TXN_STATUS = {
  MATCHED: 'Matched',
  UNMATCHED: 'Unmatched',
};

/**
 * Whether a positive *net* movement in the account's own unit is a debit.
 * Assets & expenses are debit-normal (more of them = debit balance); the rest
 * are credit-normal. Used to compute running balances and reports.
 */
const DEBIT_NORMAL_TYPES = [ACCOUNT_TYPES.ASSET, ACCOUNT_TYPES.EXPENSE];

module.exports = {
  ACCOUNT_TYPES,
  ACCOUNT_TYPES_LIST,
  ENTRY_STATUS,
  VOUCHER_STATUS,
  VOUCHER_KIND,
  PAY_METHODS,
  INVOICE_STATUS,
  BUDGET_STATUS,
  BANK_TXN_STATUS,
  DEBIT_NORMAL_TYPES,
};
