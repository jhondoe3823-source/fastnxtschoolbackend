/**
 * Shared fee payment + receipt service.
 *
 * Both POST /fees/invoices/:id/pay and POST /accounts/receivables/:id/pay
 * delegate here so invoice updates, receipt numbers, vouchers and journal
 * entries stay consistent and transactional.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { badRequest, notFound, conflict } = require('../../utils/errors');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const accountService = require('../accounts/account.service');
const { resolveBranchId, branchWhere } = require('../accounts/branch-scope');

const trimmed = (val) => String(val ?? '').trim();
const toInt = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const PAYMENT_METHODS = new Set(['Cash', 'Bank', 'Cheque', 'Online']);

function deriveInvoiceStatus({ total, discount, paid, due }) {
  const net = Math.max(0, (total || 0) - (discount || 0));
  const balance = Math.max(0, net - (paid || 0));
  if (balance <= 0 && net > 0) return { balance: 0, status: 'Paid' };
  if ((paid || 0) > 0 && balance > 0) return { balance, status: 'Partially Paid' };
  if (due && balance > 0) {
    const today = new Date().toISOString().slice(0, 10);
    if (due < today) return { balance, status: 'Overdue' };
  }
  return { balance, status: balance <= 0 ? 'Paid' : 'Pending' };
}

function serializeInvoice(r) {
  return {
    id: r.id,
    invoiceNo: r.invoiceNo,
    branchId: r.branchId || null,
    studentId: r.studentId || null,
    student: r.student,
    studentCode: r.studentCode || null,
    cls: r.cls,
    section: r.section,
    session: r.session || null,
    period: r.period,
    issue: r.issue,
    due: r.due,
    total: r.total,
    discount: r.discount,
    paid: r.paid,
    balance: r.balance,
    status: r.status,
    discountTypeId: r.discountTypeId || null,
    discountName: r.discountName || null,
    lines: Array.isArray(r.lines) ? r.lines : [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializePayment(p, { duplicate = false, course = null } = {}) {
  const school = p.schoolSnapshot && typeof p.schoolSnapshot === 'object' ? p.schoolSnapshot : {};
  const lines = Array.isArray(p.linesSnapshot) ? p.linesSnapshot : [];
  return {
    id: p.id,
    receiptNo: p.receiptNo,
    invoiceId: p.invoiceId,
    invoiceNo: p.invoiceNo,
    branchId: p.branchId || null,
    studentId: p.studentId || null,
    studentName: p.studentName,
    studentCode: p.studentCode || null,
    admissionNo: p.admissionNo || null,
    cls: p.cls,
    section: p.section,
    course: course || null,
    session: p.session || null,
    period: p.period,
    amount: p.amount,
    method: p.method,
    reference: p.reference || '',
    cashBankAccountId: p.cashBankAccountId || null,
    cashBankAccountName: p.cashBankAccountName || '',
    cashBankAccountNumber: p.cashBankAccountNumber || '',
    cashierId: p.cashierId || null,
    cashierName: p.cashierName || '',
    paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
    grossAmount: p.grossAmount,
    discount: p.discount,
    previousBalance: p.previousBalance,
    remainingBalance: p.remainingBalance,
    status: p.status,
    lines,
    school,
    voucherId: p.voucherId || null,
    voucherNo: p.voucherNo || null,
    journalEntryId: p.journalEntryId || null,
    reprintCount: p.reprintCount || 0,
    duplicate: Boolean(duplicate),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function nextReceiptNo(tx, schoolId) {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const latest = await tx.feePayment.findFirst({
    where: { schoolId, receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: 'desc' },
    select: { receiptNo: true },
  });
  const seq = latest ? Number(latest.receiptNo.split('-').pop()) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function nextVoucherNo(tx, schoolId, kind) {
  const prefix = kind === 'Receipt' ? 'RV' : 'PV';
  const last = await tx.voucher.findFirst({
    where: { schoolId, kind },
    orderBy: { no: 'desc' },
    select: { no: true },
  });
  const seq = last ? Number(String(last.no).replace(/\D/g, '')) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function nextJournalNo(tx, schoolId) {
  const last = await tx.journalEntry.findFirst({
    where: { schoolId },
    orderBy: { no: 'desc' },
    select: { no: true },
  });
  const seq = last ? Number(String(last.no).replace(/\D/g, '')) + 1 : 1;
  return `JE-${String(seq).padStart(4, '0')}`;
}

/**
 * Resolve ledger Cash/Bank account + display meta for the selected BankAccount.
 * `preferredId` may be a BankAccount.id or a Chart-of-Accounts Account.id.
 * Returns `{ account, cashBankAccountId, cashBankAccountName, cashBankAccountNumber }`.
 */
async function resolveCashBankAccount(tx, schoolId, method, preferredId) {
  const pack = (account, bankRow = null) => {
    if (!account) return null;
    return {
      account,
      cashBankAccountId: bankRow?.id || account.id,
      cashBankAccountName: bankRow?.name || account.name || '',
      cashBankAccountNumber: bankRow?.number && bankRow.number !== '—' ? bankRow.number : '',
    };
  };

  if (preferredId) {
    const bankRow = await tx.bankAccount.findFirst({
      where: { id: preferredId, schoolId, isActive: true },
      include: { account: true },
    });
    if (bankRow?.account) return pack(bankRow.account, bankRow);

    const acc = await tx.account.findFirst({
      where: { id: preferredId, schoolId, isActive: true },
    });
    if (acc) {
      const linked = await tx.bankAccount.findFirst({
        where: { schoolId, accountId: acc.id, isActive: true },
      });
      return pack(acc, linked);
    }
  }

  // Chart of accounts must already be ensured by the caller (outside the tx).
  let account = null;
  if (method === 'Cash') {
    account =
      (await tx.account.findFirst({ where: { schoolId, code: '1001', isActive: true } })) ||
      (await tx.account.findFirst({
        where: { schoolId, type: 'Asset', name: { contains: 'Cash', mode: 'insensitive' }, isActive: true },
      }));
  } else {
    account =
      (await tx.account.findFirst({ where: { schoolId, code: '1002', isActive: true } })) ||
      (await tx.account.findFirst({
        where: { schoolId, type: 'Asset', name: { contains: 'Bank', mode: 'insensitive' }, isActive: true },
      }));
  }

  if (!account) return null;

  const linked = await tx.bankAccount.findFirst({
    where: {
      schoolId,
      accountId: account.id,
      isActive: true,
      ...(method === 'Cash' ? { kind: 'Cash' } : { kind: 'Bank' }),
    },
  });
  return pack(account, linked);
}

async function resolveTuitionAccount(tx, schoolId) {
  // Chart of accounts must already be ensured by the caller (outside the tx).
  const byName = await tx.account.findFirst({
    where: { schoolId, name: 'Tuition Fees', isActive: true },
  });
  if (byName) return byName;
  return tx.account.findFirst({ where: { schoolId, code: '4001', isActive: true } });
}

async function loadCashierName(auth = {}) {
  if (auth?.name || auth?.userName) return trimmed(auth.name || auth.userName);
  if (!auth?.userId) return '';
  const user = await prisma.user.findFirst({
    where: { id: auth.userId },
    select: { name: true },
  });
  return user?.name || '';
}

async function buildSchoolSnapshot(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      name: true,
      shortName: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      logoUrl: true,
      principal: true,
      academicSession: true,
    },
  });
  if (!school) throw notFound('School not found.');
  return {
    name: school.name,
    shortName: school.shortName,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    logoUrl: school.logoUrl,
    principal: school.principal,
    academicSession: school.academicSession,
  };
}

/**
 * Record a fee payment against a fee invoice.
 * Idempotent when `idempotencyKey` is supplied and already used for this school.
 */
async function collectPayment(schoolId, invoiceId, input = {}, auth = {}) {
  const method = trimmed(input.method) || 'Cash';
  if (!PAYMENT_METHODS.has(method)) {
    throw badRequest('Payment method must be Cash, Bank, Cheque or Online.');
  }

  const idempotencyKey = trimmed(input.idempotencyKey) || null;
  if (idempotencyKey) {
    const existing = await prisma.feePayment.findFirst({
      where: { schoolId, idempotencyKey },
    });
    if (existing) {
      const invoice = await prisma.feeInvoice.findFirst({ where: { id: existing.invoiceId, schoolId } });
      return {
        invoice: serializeInvoice(invoice || { id: existing.invoiceId }),
        payment: serializePayment(existing),
        voucher: existing.voucherId
          ? { id: existing.voucherId, no: existing.voucherNo, kind: 'Receipt', amount: existing.amount, method: existing.method }
          : null,
        idempotent: true,
      };
    }
  }

  const cashierName = trimmed(input.cashierName) || (await loadCashierName(auth));
  const cashierId = auth?.userId || null;
  const reference = trimmed(input.reference);
  const schoolSnapshot = await buildSchoolSnapshot(schoolId);

  // Heavy setup stays outside the interactive transaction — Neon/Railway often
  // exceeds Prisma's default 5s timeout when chart-of-accounts seeding runs inside.
  await accountService.ensureDefaultChartOfAccounts(schoolId);
  const preferredBranchId = await resolveBranchId(schoolId, input.branchId);

  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const inv = await tx.feeInvoice.findFirst({ where: { id: invoiceId, schoolId } });
          if (!inv) throw notFound('Fee invoice not found.');

          const net = Math.max(0, inv.total - inv.discount);
          const previousBalance = Math.max(0, net - inv.paid);
          if (previousBalance <= 0) {
            throw badRequest('This invoice is already fully paid.');
          }

          const requested =
            input.amount !== undefined && input.amount !== null && input.amount !== ''
              ? toInt(input.amount)
              : previousBalance;

          if (requested <= 0) throw badRequest('Payment amount must be greater than zero.');
          if (requested > previousBalance) {
            throw badRequest(
              `Payment amount (Rs ${requested}) exceeds outstanding balance (Rs ${previousBalance}).`
            );
          }

          let studentMeta = {
            admissionNo: null,
            session: inv.session || null,
            studentCode: inv.studentCode || null,
          };
          if (inv.studentId) {
            const st = await tx.student.findFirst({
              where: { id: inv.studentId, schoolId },
              select: { admissionNo: true, session: true, studentId: true },
            });
            if (st) {
              studentMeta = {
                admissionNo: st.admissionNo || null,
                session: inv.session || st.session || schoolSnapshot.academicSession || null,
                studentCode: inv.studentCode || st.studentId || null,
              };
            }
          }

          const newPaid = inv.paid + requested;
          const derived = deriveInvoiceStatus({
            total: inv.total,
            discount: inv.discount,
            paid: newPaid,
            due: inv.due,
          });
          const paymentStatus = derived.balance === 0 ? 'PAID' : 'PARTIAL PAYMENT';

          const receiptNo = await nextReceiptNo(tx, schoolId);
          const branchId = inv.branchId || preferredBranchId;

          const tuitionAcc = await resolveTuitionAccount(tx, schoolId);
          if (!tuitionAcc) throw badRequest('Tuition Fees account is not configured.');

          const cashBankResolved = await resolveCashBankAccount(
            tx,
            schoolId,
            method,
            trimmed(input.cashBankAccountId) || null
          );
          if (!cashBankResolved?.account) {
            throw badRequest(
              method === 'Cash'
                ? 'Could not resolve a Cash account. Please select one.'
                : 'Could not resolve a Bank account. Please select one.'
            );
          }
          const cashBankAcc = cashBankResolved.account;

          const voucherNo = await nextVoucherNo(tx, schoolId, 'Receipt');
          const jeNo = await nextJournalNo(tx, schoolId);
          const paidAt = new Date();

          const journal = await tx.journalEntry.create({
            data: {
              schoolId,
              branchId,
              no: jeNo,
              date: paidAt,
              description: `Fee receipt ${receiptNo} — ${inv.student} (${inv.invoiceNo})`,
              reference: receiptNo,
              status: 'Posted',
              notes: `Fee payment for invoice ${inv.invoiceNo}`,
              createdById: cashierId || null,
              createdByName: cashierName || 'System',
              postedAt: paidAt,
              lines: {
                create: [
                  {
                    accountId: cashBankAcc.id,
                    description: `Fee receipt from ${inv.student} (${receiptNo})`,
                    debit: requested,
                    credit: 0,
                  },
                  {
                    accountId: tuitionAcc.id,
                    description: `Fee receipt for ${inv.student} (${receiptNo})`,
                    debit: 0,
                    credit: requested,
                  },
                ],
              },
            },
          });

          const voucher = await tx.voucher.create({
            data: {
              schoolId,
              branchId,
              no: voucherNo,
              kind: 'Receipt',
              date: paidAt,
              party: inv.student,
              accountId: tuitionAcc.id,
              amount: requested,
              method,
              cashBankAccountId: cashBankResolved.cashBankAccountId || cashBankAcc.id,
              reference: `${inv.invoiceNo} / ${receiptNo}`,
              status: 'Posted',
              journalEntryId: journal.id,
            },
          });

          const payment = await tx.feePayment.create({
            data: {
              schoolId,
              branchId,
              receiptNo,
              invoiceId: inv.id,
              invoiceNo: inv.invoiceNo,
              studentId: inv.studentId || null,
              studentName: inv.student,
              studentCode: studentMeta.studentCode,
              admissionNo: studentMeta.admissionNo,
              cls: inv.cls,
              section: inv.section,
              session: studentMeta.session,
              period: inv.period,
              amount: requested,
              method,
              reference,
              cashBankAccountId: cashBankResolved.cashBankAccountId || cashBankAcc.id,
              cashBankAccountName: cashBankResolved.cashBankAccountName || '',
              cashBankAccountNumber: cashBankResolved.cashBankAccountNumber || '',
              cashierId,
              cashierName,
              paidAt,
              grossAmount: inv.total,
              discount: inv.discount,
              previousBalance,
              remainingBalance: derived.balance,
              status: paymentStatus,
              linesSnapshot: Array.isArray(inv.lines) ? inv.lines : [],
              schoolSnapshot,
              voucherId: voucher.id,
              voucherNo: voucher.no,
              journalEntryId: journal.id,
              idempotencyKey,
            },
          });

          const updatedInvoice = await tx.feeInvoice.update({
            where: { id: inv.id },
            data: {
              paid: newPaid,
              balance: derived.balance,
              status: derived.status,
              session: inv.session || studentMeta.session || null,
            },
          });

          return {
            invoice: serializeInvoice(updatedInvoice),
            payment: serializePayment(payment),
            voucher: {
              id: voucher.id,
              no: voucher.no,
              kind: voucher.kind,
              amount: voucher.amount,
              method: voucher.method,
              journalEntryId: journal.id,
              status: voucher.status,
            },
            idempotent: false,
          };
        },
        { maxWait: 10000, timeout: 20000 }
      );

      logger.info(
        `Fee payment ${result.payment.receiptNo}: Rs ${result.payment.amount} for invoice ${result.invoice.invoiceNo}`
      );
      return result;
    } catch (err) {
      lastError = err;
      // Unique receipt / idempotency race — retry or return existing
      if (err?.code === 'P2002') {
        const targets = err?.meta?.target || [];
        if (idempotencyKey && (targets.includes('idempotencyKey') || String(targets).includes('idempotencyKey'))) {
          const existing = await prisma.feePayment.findFirst({
            where: { schoolId, idempotencyKey },
          });
          if (existing) {
            const invoice = await prisma.feeInvoice.findFirst({ where: { id: existing.invoiceId, schoolId } });
            return {
              invoice: serializeInvoice(invoice || { id: existing.invoiceId }),
              payment: serializePayment(existing),
              voucher: existing.voucherId
                ? { id: existing.voucherId, no: existing.voucherNo, kind: 'Receipt', amount: existing.amount, method: existing.method }
                : null,
              idempotent: true,
            };
          }
        }
        continue;
      }
      throw err;
    }
  }

  throw lastError || conflict('Could not allocate a unique receipt number. Please retry.');
}

async function getPayment(schoolId, paymentId) {
  const payment = await prisma.feePayment.findFirst({ where: { id: paymentId, schoolId } });
  if (!payment) throw notFound('Fee receipt not found.');
  return serializePayment(payment);
}

async function getReceipt(schoolId, paymentId, { duplicate = false } = {}) {
  const payment = await getPayment(schoolId, paymentId);
  return { ...payment, duplicate: Boolean(duplicate) };
}

/**
 * Log a reprint / duplicate copy. Does NOT create a payment or journal entry.
 */
async function recordReprint(schoolId, paymentId, auth = {}) {
  const payment = await prisma.feePayment.findFirst({ where: { id: paymentId, schoolId } });
  if (!payment) throw notFound('Fee receipt not found.');

  const userName = await loadCashierName(auth);
  const [, updated] = await prisma.$transaction([
    prisma.feeReceiptReprint.create({
      data: {
        schoolId,
        paymentId: payment.id,
        receiptNo: payment.receiptNo,
        userId: auth?.userId || null,
        userName,
      },
    }),
    prisma.feePayment.update({
      where: { id: payment.id },
      data: { reprintCount: { increment: 1 } },
    }),
  ]);

  return serializePayment(updated, { duplicate: true });
}

async function listPayments(schoolId, query = {}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { schoolId, ...branchWhere(query.branchId) };

  if (query.invoiceId) where.invoiceId = trimmed(query.invoiceId);
  if (query.studentId) where.studentId = trimmed(query.studentId);
  if (query.method) where.method = trimmed(query.method);
  if (query.status) where.status = trimmed(query.status);
  if (query.cls) where.cls = trimmed(query.cls);
  if (query.section) where.section = trimmed(query.section);
  if (query.receiptNo) where.receiptNo = { contains: trimmed(query.receiptNo), mode: 'insensitive' };
  if (query.invoiceNo) where.invoiceNo = { contains: trimmed(query.invoiceNo), mode: 'insensitive' };

  if (query.from || query.to) {
    where.paidAt = {};
    if (query.from) where.paidAt.gte = new Date(query.from);
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      where.paidAt.lte = to;
    }
  }

  const q = trimmed(query.q);
  if (q) {
    const lower = q.toLowerCase();
    const studentMatch = [
      { name: { contains: q, mode: 'insensitive' } },
      { studentId: { contains: q, mode: 'insensitive' } },
      { admissionNo: { contains: q, mode: 'insensitive' } },
      { course: { contains: q, mode: 'insensitive' } },
      { cls: { contains: q, mode: 'insensitive' } },
    ];
    if (lower === 'law' || lower === 'general') {
      studentMatch.push({ admissionExtras: { path: ['category'], equals: 'law' } });
      studentMatch.push({ admissionExtras: { path: ['category'], equals: 'general' } });
    }
    if (lower === 'it' || lower === 'nursing') {
      studentMatch.push({ admissionExtras: { path: ['category'], equals: lower } });
    }
    const matchedStudents = await prisma.student.findMany({
      where: { schoolId, OR: studentMatch },
      select: { id: true },
      take: 300,
    });
    const studentIds = matchedStudents.map((s) => s.id);
    where.OR = [
      { studentName: { contains: q, mode: 'insensitive' } },
      { studentCode: { contains: q, mode: 'insensitive' } },
      { admissionNo: { contains: q, mode: 'insensitive' } },
      { receiptNo: { contains: q, mode: 'insensitive' } },
      { invoiceNo: { contains: q, mode: 'insensitive' } },
      { reference: { contains: q, mode: 'insensitive' } },
      ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.feePayment.count({ where }),
    prisma.feePayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      skip,
      take,
    }),
  ]);

  const studentIds = [...new Set(rows.map((p) => p.studentId).filter(Boolean))];
  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { schoolId, id: { in: studentIds } },
        select: { id: true, course: true },
      })
    : [];
  const courseByStudent = new Map(students.map((s) => [s.id, s.course || null]));

  return {
    payments: rows.map((p) =>
      serializePayment(p, { course: (p.studentId && courseByStudent.get(p.studentId)) || null })
    ),
    meta: buildMeta({ page, pageSize }, total),
  };
}

async function listInvoicePayments(schoolId, invoiceId) {
  const inv = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId }, select: { id: true } });
  if (!inv) throw notFound('Invoice not found.');
  const rows = await prisma.feePayment.findMany({
    where: { schoolId, invoiceId },
    orderBy: { paidAt: 'desc' },
  });
  return rows.map((p) => serializePayment(p));
}

/**
 * Portal: payments for the signed-in student's linked Student row (email match).
 */
async function listMyPayments(schoolId, auth = {}, query = {}) {
  const studentService = require('../students/student.service');
  const student = await studentService.getMyStudent(schoolId, auth);
  if (!student?.id) throw badRequest('No student profile is linked to this login.');
  return listPayments(schoolId, { ...query, studentId: student.id });
}

module.exports = {
  collectPayment,
  getPayment,
  getReceipt,
  recordReprint,
  listPayments,
  listInvoicePayments,
  listMyPayments,
  serializePayment,
  serializeInvoice,
  deriveInvoiceStatus,
};
