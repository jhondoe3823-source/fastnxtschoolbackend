/**
 * Fee Receivables in Accounting Service.
 *
 * Bridges the student fee invoicing module with the double-entry accounting engine:
 *   - Aggregates accounts receivable outstanding from real fee invoices.
 *   - Collecting fee payments uses the shared fee-payment service (receipt + RV + JE).
 */

const prisma = require('../../config/database').prisma;
const { branchWhere } = require('./branch-scope');

const trimmed = (value) => String(value ?? '').trim();

/** List fee receivables with financial stats. */
async function listReceivables(schoolId, { q, status, cls, section, branchId } = {}) {
  const where = { schoolId, ...branchWhere(branchId) };
  if (status) {
    // UI uses Partial; invoices use Partially Paid
    const s = trimmed(status);
    if (s === 'Partial') where.status = 'Partially Paid';
    else where.status = s;
  }
  if (cls) where.cls = cls;
  if (section) where.section = section;

  if (q) {
    const term = trimmed(q);
    const matchingStudents = await prisma.student.findMany({
      where: {
        schoolId,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { studentId: { contains: term, mode: 'insensitive' } },
          { admissionNo: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    const studentIds = matchingStudents.map((s) => s.id);
    where.OR = [
      { student: { contains: term, mode: 'insensitive' } },
      { invoiceNo: { contains: term, mode: 'insensitive' } },
      { studentCode: { contains: term, mode: 'insensitive' } },
      ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
    ];
  }

  const invoices = await prisma.feeInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const studentIds = [...new Set(invoices.map((inv) => inv.studentId).filter(Boolean))];
  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { schoolId, id: { in: studentIds } },
        select: { id: true, course: true },
      })
    : [];
  const courseByStudent = new Map(students.map((s) => [s.id, s.course || null]));

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
      course: (inv.studentId && courseByStudent.get(inv.studentId)) || null,
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
  const currentDue = rows
    .filter((r) => r.status === 'Pending' || r.status === 'Partial')
    .reduce((s, r) => s + r.outstanding, 0);
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
 * Collect a fee payment — shared transactional payment + receipt + accounting.
 */
async function collectFeePayment(schoolId, invoiceId, input, auth = {}) {
  const feePaymentService = require('../fees/fee-payment.service');
  const result = await feePaymentService.collectPayment(schoolId, invoiceId, input, auth);
  return {
    invoice: result.invoice,
    voucher: result.voucher,
    payment: result.payment,
    idempotent: result.idempotent,
  };
}

module.exports = {
  listReceivables,
  collectFeePayment,
};
