/**
 * Accounts Dashboard Overview Service.
 *
 * Computes live KPIs, trend charts, and categorical breakdowns directly from
 * posted ledger lines and vouchers, optionally scoped to one campus.
 */

const prisma = require('../../config/database').prisma;
const ledgerService = require('./ledger.service');
const voucherService = require('./voucher.service');
const accountService = require('./account.service');
const { branchWhere } = require('./branch-scope');

async function getDashboardOverview(schoolId, { branchId } = {}) {
  await accountService.ensureDefaultChartOfAccounts(schoolId);

  // 1. Fetch Profit & Loss for live Income & Expense totals
  const pl = await ledgerService.profitAndLoss(schoolId, { branchId });
  const totalIncome = pl.totalIncome;
  const totalExpense = pl.totalExpenses;
  const net = pl.net;

  // 2. Fetch Cash & Bank summary
  const cashBank = await ledgerService.cashBankSummary(schoolId, { branchId });

  // 3. Fee Invoices collection stats
  const feeInvoices = await prisma.feeInvoice.findMany({
    where: { schoolId, ...branchWhere(branchId) },
    select: { total: true, discount: true, paid: true, balance: true },
  });

  const collectedFees = feeInvoices.reduce((s, inv) => s + (inv.paid || 0), 0);
  const pendingFees = feeInvoices.reduce((s, inv) => s + (inv.balance || 0), 0);

  // 4. Income by category
  let incomeCats = pl.income.map((i) => ({ label: i.name, value: Math.max(0, i.amount) }));
  if (incomeCats.length === 0) {
    incomeCats = [
      { label: 'Tuition Fees', value: collectedFees || 0 },
      { label: 'Admission Fees', value: 0 },
      { label: 'Other Income', value: 0 },
    ];
  }

  // 5. Expenses by category
  let expenseCats = pl.expenses.map((e) => ({ label: e.name, value: Math.max(0, e.amount) }));
  if (expenseCats.length === 0) {
    expenseCats = [
      { label: 'Salaries', value: 0 },
      { label: 'Rent', value: 0 },
      { label: 'Utilities', value: 0 },
      { label: 'Maintenance', value: 0 },
    ];
  }

  // 6. Recent vouchers
  const recentVouchers = await voucherService.listVouchers(schoolId, { branchId });
  const recent = recentVouchers.slice(0, 8);

  // 7. Recent journal entries
  const recentJournals = await prisma.journalEntry.findMany({
    where: { schoolId, ...branchWhere(branchId) },
    orderBy: { date: 'desc' },
    take: 6,
    include: {
      lines: {
        include: { account: { select: { name: true } } },
      },
    },
  });

  return {
    kpis: {
      totalIncome,
      totalExpense,
      net,
      cash: cashBank.cash,
      bank: cashBank.bank,
      totalAvailable: cashBank.total,
      collectedFees,
      pendingFees,
    },
    incomeCats,
    expenseCats,
    recentVouchers: recent,
    recentJournals: recentJournals.map((j) => ({
      id: j.id,
      no: j.no,
      date: j.date.toISOString().slice(0, 10),
      description: j.description,
      status: j.status,
      debit: j.lines.reduce((s, l) => s + l.debit, 0),
      credit: j.lines.reduce((s, l) => s + l.credit, 0),
    })),
  };
}

module.exports = {
  getDashboardOverview,
};
