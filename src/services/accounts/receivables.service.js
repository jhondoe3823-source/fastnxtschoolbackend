/**
 * Fee Receivables in Accounting Service.
 *
 * Bridges the student fee invoicing module with the double-entry accounting engine:
 *   - Aggregates accounts receivable outstanding from real fee invoices.
 *   - Collecting fee payments records a posted Receipt Voucher and balanced Journal Entry,
 *     which directly moves Cash/Bank and Tuition Fees in the accounting books.
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { badRequest, notFound } = require('../../utils/errors');
const voucherService = require('./voucher.service');
const { branchWhere } = require('./branch-scope');

const trimmed = (value) => String(value ?? '').trim();
const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));

/** List fee receivables with financial stats. */
async function listReceivables(schoolId, { q, status, cls, section, branchId } = {}) {
  const where = { schoolId, ...branchWhere(branchId) };
  if (status) where.status = status;
  if (cls) where.cls = cls;
  if (section) where.section = section;

  if (q) {
    const term = trimmed(q);
    where.OR = [
      { student: { contains: term, mode: 'insensitive' } },
      { invoiceNo: { contains: term, mode: 'insensitive' } },
      { studentCode: { contains: term, mode: 'insensitive' } },
    ];
  }

  const invoices = await prisma.feeInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const today = new Date().toISOString().slice(0, 10);

  const rows = invoices.map((inv) => {
    const net = Math.max(0, inv.total - inv.discount);
    const balance = Math.max(0, net - inv.paid);

    let derivedStatus = inv.status;
    if (balance <= 0 && net > 0) derivedStatus = 'Paid';
    else if (inv.due && inv.due < today && balance > 0) derivedStatus = 'Overdue';
    else if (inv.paid > 0 && balance > 0) derivedStatus = 'Partial';
    else if (balance > 0) derivedStatus = 'Pending';

    return {
      id: inv.id,
      student: inv.student,
      sid: inv.studentCode || 'ST-' + inv.id.slice(-4),
      cls: inv.cls,
      section: inv.section,
      invoice: inv.invoiceNo,
      dueDate: inv.due,
      total: inv.total,
      discount: inv.discount,
      net,
      paid: inv.paid,
      outstanding: balance,
      status: derivedStatus,
    };
  });

  const total = rows.reduce((s, r) => s + r.outstanding, 0);
  const overdue = rows.filter((r) => r.status === 'Overdue').reduce((s, r) => s + r.outstanding, 0);
  const currentDue = rows.filter((r) => r.status === 'Pending' || r.status === 'Partial').reduce((s, r) => s + r.outstanding, 0);
  const collected = rows.reduce((s, r) => s + r.paid, 0);

  return {
    rows,
    summary: {
      total,
      currentDue,
      overdue,
      collected,
      totalCount: rows.length,
    },
  };
}

/**
 * Collect a fee payment on an invoice and immediately post to accounting.
 */
async function collectFeePayment(schoolId, invoiceId, input, auth = {}) {
  const inv = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId } });
  if (!inv) throw notFound('Fee invoice not found.');

  const net = Math.max(0, inv.total - inv.discount);
  const currentBalance = Math.max(0, net - inv.paid);
  if (currentBalance <= 0) {
    throw badRequest('This invoice is already fully paid.');
  }

  const payAmount = input.amount !== undefined ? toInt(input.amount) : currentBalance;
  if (payAmount <= 0) throw badRequest('Payment amount must be greater than zero.');

  const newPaid = Math.min(net, inv.paid + payAmount);
  const newBalance = Math.max(0, net - newPaid);
  const newStatus = newBalance === 0 ? 'Paid' : 'Partially Paid';

  // 1. Update the fee invoice
  const updatedInvoice = await prisma.feeInvoice.update({
    where: { id: invoiceId },
    data: {
      paid: newPaid,
      balance: newBalance,
      status: newStatus,
    },
  });

  // 2. Automatically create & post Receipt Voucher into accounting
  const method = trimmed(input.method) || 'Cash';
  const voucher = await voucherService.createVoucher(
    schoolId,
    {
      kind: 'Receipt',
      party: inv.student,
      account: 'Tuition Fees',
      amount: payAmount,
      method,
      cashBankAccountId: trimmed(input.cashBankAccountId) || undefined,
      reference: inv.invoiceNo,
      status: 'Posted',
      branchId: inv.branchId || input.branchId || null,
    },
    auth
  );

  logger.info(`Collected Rs. ${payAmount} for invoice ${inv.invoiceNo} and posted RV ${voucher.no}.`);

  return {
    invoice: updatedInvoice,
    voucher,
  };
}

module.exports = {
  listReceivables,
  collectFeePayment,
};
