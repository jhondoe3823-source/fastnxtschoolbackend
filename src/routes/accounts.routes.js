/**
 * Accounting Routes.
 *
 * Exposes all REST endpoints for Chart of Accounts, Journal Entries, Vouchers,
 * Ledgers, Financial Reports, Cash & Bank, Budgets, and Fee Receivables.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const accountController = require('../controllers/accounts/account.controller');

const router = express.Router();

router.use(requireAuth);

// ── Dashboard Overview ──
router.get('/dashboard', accountController.getDashboard);

// ── Chart of Accounts ──
router.get('/chart', accountController.listAccounts);
router.post('/chart', accountController.createAccount);
router.post('/chart/seed', accountController.seedDefaults);
router.get('/chart/:id', accountController.getAccount);
router.patch('/chart/:id', accountController.updateAccount);
router.delete('/chart/:id', accountController.deleteAccount);

// ── Journal Entries ──
router.get('/journals', accountController.listJournalEntries);
router.post('/journals', accountController.createJournalEntry);
router.get('/journals/:id', accountController.getJournalEntry);
router.patch('/journals/:id', accountController.updateJournalEntry);
router.post('/journals/:id/post', accountController.postJournalEntry);
router.post('/journals/:id/cancel', accountController.cancelJournalEntry);
router.post('/journals/:id/reverse', accountController.reverseJournalEntry);
router.delete('/journals/:id', accountController.deleteJournalEntry);

// ── Vouchers (Receipt & Payment) ──
router.get('/vouchers', accountController.listVouchers);
router.post('/vouchers', accountController.createVoucher);
router.get('/vouchers/:id', accountController.getVoucher);
router.post('/vouchers/:id/post', accountController.postVoucher);
router.post('/vouchers/:id/cancel', accountController.cancelVoucher);
router.delete('/vouchers/:id', accountController.deleteVoucher);

// ── Ledgers & Reports ──
router.get('/ledger', accountController.getGeneralLedger);
router.get('/statement', accountController.getAccountStatement);
router.get('/trial-balance', accountController.getTrialBalance);
router.get('/profit-loss', accountController.getProfitLoss);
router.get('/balance-sheet', accountController.getBalanceSheet);
router.get('/cash-flow', accountController.getCashFlow);

// ── Cash & Bank / Bank Reconciliation ──
router.get('/cash-bank', accountController.getCashBankSummary);
router.get('/bank-accounts', accountController.listBankAccounts);
router.post('/bank-accounts', accountController.createBankAccount);
router.get('/bank-transactions', accountController.listBankTransactions);
router.post('/bank-transactions', accountController.createBankTransaction);
router.patch('/bank-transactions/:id/status', accountController.updateBankTransactionStatus);
router.post('/bank-transactions/mark-all-matched', accountController.markAllMatched);
router.get('/bank-reconciliation', accountController.getReconciliationSummary);

// ── Budgets ──
router.get('/budgets', accountController.listBudgets);
router.post('/budgets', accountController.createBudget);
router.patch('/budgets/:id', accountController.updateBudget);
router.delete('/budgets/:id', accountController.deleteBudget);

// ── Fee Receivables in Accounting ──
router.get('/receivables', accountController.listReceivables);
router.post('/receivables/:id/pay', accountController.collectFeePayment);

module.exports = router;
