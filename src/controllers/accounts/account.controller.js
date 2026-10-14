/**
 * Accounting Module Controller.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const accountService = require('../../services/accounts/account.service');
const journalService = require('../../services/accounts/journal.service');
const voucherService = require('../../services/accounts/voucher.service');
const ledgerService = require('../../services/accounts/ledger.service');
const bankService = require('../../services/accounts/bank.service');
const budgetService = require('../../services/accounts/budget.service');
const receivablesService = require('../../services/accounts/receivables.service');
const dashboardService = require('../../services/accounts/dashboard.service');

// ── Dashboard ─────────────────────────────────────────────────────────────
const getDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardOverview(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Accounts dashboard loaded successfully.', data);
});

// ── Chart of Accounts ─────────────────────────────────────────────────────
const listAccounts = asyncHandler(async (req, res) => {
  await accountService.ensureDefaultChartOfAccounts(req.auth.schoolId);
  const accounts = await accountService.listAccounts(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Chart of accounts loaded successfully.', { accounts });
});

const getAccount = asyncHandler(async (req, res) => {
  const account = await accountService.getAccount(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Account loaded successfully.', { account });
});

const createAccount = asyncHandler(async (req, res) => {
  const account = await accountService.createAccount(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Account created successfully.', { account });
});

const updateAccount = asyncHandler(async (req, res) => {
  const account = await accountService.updateAccount(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Account updated successfully.', { account });
});

const deleteAccount = asyncHandler(async (req, res) => {
  await accountService.deleteAccount(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Account deleted successfully.', { deleted: true });
});

const seedDefaults = asyncHandler(async (req, res) => {
  await accountService.ensureDefaultChartOfAccounts(req.auth.schoolId);
  const accounts = await accountService.listAccounts(req.auth.schoolId);
  return ApiResponse.ok(res, 'Default accounts ensured.', { accounts });
});

// ── Journal Entries ───────────────────────────────────────────────────────
const listJournalEntries = asyncHandler(async (req, res) => {
  const entries = await journalService.listEntries(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Journal entries loaded successfully.', { entries });
});

const getJournalEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.getEntry(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Journal entry loaded successfully.', { entry });
});

const createJournalEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.createEntry(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Journal entry created successfully.', { entry });
});

const updateJournalEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.updateEntry(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, 'Journal entry updated successfully.', { entry });
});

const postJournalEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.postEntry(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Journal entry posted successfully.', { entry });
});

const cancelJournalEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.cancelEntry(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Journal entry cancelled successfully.', { entry });
});

const reverseJournalEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.reverseEntry(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.created(res, 'Journal entry reversed successfully.', { entry });
});

const deleteJournalEntry = asyncHandler(async (req, res) => {
  await journalService.deleteEntry(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Journal entry deleted successfully.', { deleted: true });
});

// ── Vouchers ──────────────────────────────────────────────────────────────
const listVouchers = asyncHandler(async (req, res) => {
  const vouchers = await voucherService.listVouchers(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Vouchers loaded successfully.', { vouchers });
});

const getVoucher = asyncHandler(async (req, res) => {
  const voucher = await voucherService.getVoucher(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Voucher loaded successfully.', { voucher });
});

const createVoucher = asyncHandler(async (req, res) => {
  const voucher = await voucherService.createVoucher(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, `${voucher.kind} voucher created successfully.`, { voucher });
});

const postVoucher = asyncHandler(async (req, res) => {
  const voucher = await voucherService.postVoucher(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Voucher posted successfully.', { voucher });
});

const cancelVoucher = asyncHandler(async (req, res) => {
  const voucher = await voucherService.cancelVoucher(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Voucher cancelled successfully.', { voucher });
});

const deleteVoucher = asyncHandler(async (req, res) => {
  await voucherService.deleteVoucher(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Voucher deleted successfully.', { deleted: true });
});

// ── Ledgers & Financial Reports ───────────────────────────────────────────
const getGeneralLedger = asyncHandler(async (req, res) => {
  let { accountId, from, to, branchId } = req.query;
  if (!accountId) {
    // pick first active asset or cash/bank account
    const accounts = await accountService.listAccounts(req.auth.schoolId);
    if (accounts.length > 0) accountId = accounts[0].id;
  }
  if (!accountId) {
    return ApiResponse.ok(res, 'No accounts found.', { account: null, rows: [], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 });
  }

  const ledger = await ledgerService.generalLedger(req.auth.schoolId, accountId, { from, to, branchId });
  return ApiResponse.ok(res, 'General ledger loaded successfully.', ledger);
});

const getAccountStatement = asyncHandler(async (req, res) => {
  const statement = await ledgerService.accountStatement(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Account statement loaded successfully.', statement);
});

const getTrialBalance = asyncHandler(async (req, res) => {
  const tb = await ledgerService.trialBalance(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Trial balance loaded successfully.', tb);
});

const getProfitLoss = asyncHandler(async (req, res) => {
  const pl = await ledgerService.profitAndLoss(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Profit and Loss statement loaded successfully.', pl);
});

const getBalanceSheet = asyncHandler(async (req, res) => {
  const bs = await ledgerService.balanceSheet(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Balance sheet loaded successfully.', bs);
});

const getCashFlow = asyncHandler(async (req, res) => {
  const cf = await ledgerService.cashFlow(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Cash flow statement loaded successfully.', cf);
});

// ── Cash & Bank / Bank Reconciliation ─────────────────────────────────────
const getCashBankSummary = asyncHandler(async (req, res) => {
  const summary = await ledgerService.cashBankSummary(req.auth.schoolId, req.query);
  const accounts = await bankService.listCashBankAccounts(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Cash & Bank summary loaded successfully.', { ...summary, accounts });
});

const listBankAccounts = asyncHandler(async (req, res) => {
  const accounts = await bankService.listCashBankAccounts(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Bank accounts loaded successfully.', { accounts });
});

const createBankAccount = asyncHandler(async (req, res) => {
  const account = await bankService.createBankAccount(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Bank account created successfully.', { account });
});

const listBankTransactions = asyncHandler(async (req, res) => {
  const txns = await bankService.listBankTransactions(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Bank transactions loaded successfully.', { txns });
});

const createBankTransaction = asyncHandler(async (req, res) => {
  const txn = await bankService.createBankTransaction(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Bank transaction created successfully.', { txn });
});

const updateBankTransactionStatus = asyncHandler(async (req, res) => {
  const result = await bankService.updateBankTransactionStatus(req.auth.schoolId, req.params.id, req.body.status);
  return ApiResponse.ok(res, 'Bank transaction updated successfully.', result);
});

const markAllMatched = asyncHandler(async (req, res) => {
  const result = await bankService.markAllMatched(req.auth.schoolId, req.body.bankAccountId);
  return ApiResponse.ok(res, 'Unmatched transactions marked as matched.', result);
});

const getReconciliationSummary = asyncHandler(async (req, res) => {
  const summary = await bankService.getReconciliationSummary(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Reconciliation summary loaded successfully.', summary);
});

// ── Budgets ───────────────────────────────────────────────────────────────
const listBudgets = asyncHandler(async (req, res) => {
  const budgets = await budgetService.listBudgets(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Budgets loaded successfully.', { budgets });
});

const createBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.createBudget(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Budget created successfully.', { budget });
});

const updateBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.updateBudget(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Budget updated successfully.', { budget });
});

const deleteBudget = asyncHandler(async (req, res) => {
  await budgetService.deleteBudget(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Budget deleted successfully.', { deleted: true });
});

// ── Fee Receivables ───────────────────────────────────────────────────────
const listReceivables = asyncHandler(async (req, res) => {
  const data = await receivablesService.listReceivables(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Fee receivables loaded successfully.', data);
});

const collectFeePayment = asyncHandler(async (req, res) => {
  const result = await receivablesService.collectFeePayment(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(
    res,
    result.idempotent
      ? 'Payment already recorded.'
      : 'Fee payment collected and posted to accounting successfully.',
    {
      invoice: result.invoice,
      voucher: result.voucher,
      payment: result.payment,
      idempotent: result.idempotent,
    }
  );
});

module.exports = {
  getDashboard,
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  seedDefaults,
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  cancelJournalEntry,
  reverseJournalEntry,
  deleteJournalEntry,
  listVouchers,
  getVoucher,
  createVoucher,
  postVoucher,
  cancelVoucher,
  deleteVoucher,
  getGeneralLedger,
  getAccountStatement,
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  getCashFlow,
  getCashBankSummary,
  listBankAccounts,
  createBankAccount,
  listBankTransactions,
  createBankTransaction,
  updateBankTransactionStatus,
  markAllMatched,
  getReconciliationSummary,
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  listReceivables,
  collectFeePayment,
};
