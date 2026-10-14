/**
 * Fees module — particulars, structure, discount types, fee invoices.
 */

const { prisma } = require('../../config/database');
const { badRequest, notFound } = require('../../utils/errors');

const FREQUENCIES = new Set(['Monthly', 'Quarterly', 'Annually', 'One-time']);
const INVOICE_STATUSES = new Set(['Paid', 'Partially Paid', 'Pending', 'Overdue']);
const BASIS = new Set(['Percentage', 'Fixed Amount']);

const trimmed = (val) => String(val ?? '').trim();
const toInt = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

function branchFilter(branchId) {
  if (!branchId || branchId === 'all') return {};
  return { OR: [{ branchId }, { branchId: null }] };
}

function serializeParticular(r) {
  return {
    id: r.id,
    branchId: r.branchId || null,
    particular: r.particular,
    description: r.description || '',
    amount: r.amount,
    frequency: r.frequency,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializeStructure(r) {
  return {
    id: r.id,
    branchId: r.branchId || null,
    session: r.session,
    cls: r.cls,
    section: r.section,
    particularId: r.particularId || null,
    particular: r.particular,
    amount: r.amount,
    frequency: r.frequency,
    dueDate: r.dueDate || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializeDiscount(r) {
  return {
    id: r.id,
    branchId: r.branchId || null,
    name: r.name,
    basis: r.basis,
    value: r.value,
    description: r.description || '',
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function deriveInvoiceStatus({ total, discount, paid, due, status }) {
  const net = Math.max(0, (total || 0) - (discount || 0));
  const balance = Math.max(0, net - (paid || 0));
  if (status && INVOICE_STATUSES.has(status) && status === 'Overdue' && balance > 0) {
    return { balance, status: 'Overdue' };
  }
  if (balance <= 0 && net > 0) return { balance: 0, status: 'Paid' };
  if (paid > 0 && balance > 0) return { balance, status: 'Partially Paid' };
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

/* ── Particulars ─────────────────────────────────────────── */

async function listParticulars(schoolId, { q, status, frequency, branchId } = {}) {
  const where = { schoolId, ...branchFilter(branchId) };
  if (status) where.status = trimmed(status);
  if (frequency) where.frequency = trimmed(frequency);
  if (q) where.particular = { contains: trimmed(q), mode: 'insensitive' };

  const rows = await prisma.feeParticular.findMany({ where, orderBy: { particular: 'asc' } });
  return rows.map(serializeParticular);
}

async function createParticular(schoolId, input) {
  const particular = trimmed(input.particular);
  if (!particular) throw badRequest('Particular name is required.');
  const frequency = trimmed(input.frequency) || 'Monthly';
  if (!FREQUENCIES.has(frequency)) throw badRequest('Invalid frequency.');

  const row = await prisma.feeParticular.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      particular,
      description: trimmed(input.description) || null,
      amount: toInt(input.amount),
      frequency,
      status: trimmed(input.status) || 'Active',
    },
  });
  return serializeParticular(row);
}

async function updateParticular(schoolId, id, input) {
  const existing = await prisma.feeParticular.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Fee particular not found.');

  const data = {};
  if (input.particular !== undefined) data.particular = trimmed(input.particular);
  if (input.description !== undefined) data.description = trimmed(input.description) || null;
  if (input.amount !== undefined) data.amount = toInt(input.amount);
  if (input.frequency !== undefined) {
    if (!FREQUENCIES.has(trimmed(input.frequency))) throw badRequest('Invalid frequency.');
    data.frequency = trimmed(input.frequency);
  }
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  return serializeParticular(await prisma.feeParticular.update({ where: { id }, data }));
}

async function deleteParticular(schoolId, id) {
  const existing = await prisma.feeParticular.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Fee particular not found.');
  await prisma.feeParticular.delete({ where: { id } });
  return { id, deleted: true };
}

/* ── Structure ───────────────────────────────────────────── */

async function listStructure(schoolId, { session, cls, section, branchId } = {}) {
  const where = { schoolId, ...branchFilter(branchId) };
  if (session) where.session = trimmed(session);
  if (cls) where.cls = trimmed(cls);
  if (section) where.section = trimmed(section);

  const rows = await prisma.feeStructure.findMany({
    where,
    orderBy: [{ session: 'desc' }, { cls: 'asc' }, { section: 'asc' }, { particular: 'asc' }],
  });
  return rows.map(serializeStructure);
}

async function createStructureLine(schoolId, input) {
  const session = trimmed(input.session);
  const cls = trimmed(input.cls);
  const section = trimmed(input.section);
  let particular = trimmed(input.particular);
  let particularId = input.particularId || null;
  const frequency = trimmed(input.frequency) || 'Monthly';

  if (!session) throw badRequest('Session is required.');
  if (!cls) throw badRequest('Class is required.');
  if (!section) throw badRequest('Section is required.');
  if (!FREQUENCIES.has(frequency)) throw badRequest('Invalid frequency.');

  if (particularId) {
    const p = await prisma.feeParticular.findFirst({ where: { id: particularId, schoolId } });
    if (p) {
      particular = p.particular;
      if (input.amount === undefined) input.amount = p.amount;
      if (!input.frequency) input.frequency = p.frequency;
    }
  }
  if (!particular) throw badRequest('Fee particular is required.');

  const row = await prisma.feeStructure.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      session,
      cls,
      section,
      particularId,
      particular,
      amount: toInt(input.amount),
      frequency: trimmed(input.frequency) || frequency,
      dueDate: trimmed(input.dueDate) || null,
    },
  });
  return serializeStructure(row);
}

async function copyStructure(schoolId, input) {
  const session = trimmed(input.session);
  const cls = trimmed(input.cls);
  const fromSection = trimmed(input.fromSection);
  const toSection = trimmed(input.toSection);
  if (!session || !cls || !fromSection || !toSection) {
    throw badRequest('session, cls, fromSection and toSection are required.');
  }
  if (fromSection === toSection) throw badRequest('Target section must be different.');

  const source = await prisma.feeStructure.findMany({
    where: { schoolId, session, cls, section: fromSection },
  });
  if (source.length === 0) throw badRequest('No fee lines to copy from the source section.');

  const created = await prisma.$transaction(
    source.map((r) =>
      prisma.feeStructure.create({
        data: {
          schoolId,
          branchId: r.branchId,
          session: r.session,
          cls: r.cls,
          section: toSection,
          particularId: r.particularId,
          particular: r.particular,
          amount: r.amount,
          frequency: r.frequency,
          dueDate: r.dueDate,
        },
      })
    )
  );

  return created.map(serializeStructure);
}

async function deleteStructureLine(schoolId, id) {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Fee structure line not found.');
  await prisma.feeStructure.delete({ where: { id } });
  return { id, deleted: true };
}

/* ── Discount types ──────────────────────────────────────── */

async function listDiscounts(schoolId, { q, basis, status, branchId } = {}) {
  const where = { schoolId, ...branchFilter(branchId) };
  if (basis) where.basis = trimmed(basis);
  if (status) where.status = trimmed(status);
  if (q) where.name = { contains: trimmed(q), mode: 'insensitive' };

  const rows = await prisma.discountType.findMany({ where, orderBy: { name: 'asc' } });
  return rows.map(serializeDiscount);
}

async function createDiscount(schoolId, input) {
  const name = trimmed(input.name);
  const basis = trimmed(input.basis) || 'Percentage';
  if (!name) throw badRequest('Discount name is required.');
  if (!BASIS.has(basis)) throw badRequest('Basis must be Percentage or Fixed Amount.');

  const row = await prisma.discountType.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      name,
      basis,
      value: toInt(input.value),
      description: trimmed(input.description) || null,
      status: trimmed(input.status) || 'Active',
    },
  });
  return serializeDiscount(row);
}

async function updateDiscount(schoolId, id, input) {
  const existing = await prisma.discountType.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Discount type not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.basis !== undefined) {
    if (!BASIS.has(trimmed(input.basis))) throw badRequest('Invalid basis.');
    data.basis = trimmed(input.basis);
  }
  if (input.value !== undefined) data.value = toInt(input.value);
  if (input.description !== undefined) data.description = trimmed(input.description) || null;
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  return serializeDiscount(await prisma.discountType.update({ where: { id }, data }));
}

async function deleteDiscount(schoolId, id) {
  const existing = await prisma.discountType.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Discount type not found.');
  await prisma.discountType.delete({ where: { id } });
  return { id, deleted: true };
}

/* ── Invoices ────────────────────────────────────────────── */

async function nextInvoiceNo(schoolId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await prisma.feeInvoice.findFirst({
    where: { schoolId, invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });
  const seq = latest ? Number(latest.invoiceNo.split('-').pop()) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function computeDiscountAmount(total, discountType, manualDiscount) {
  if (manualDiscount !== undefined && manualDiscount !== null && manualDiscount !== '') {
    return Math.min(total, Math.max(0, toInt(manualDiscount)));
  }
  if (!discountType) return 0;
  if (discountType.basis === 'Percentage') {
    return Math.min(total, Math.round((total * discountType.value) / 100));
  }
  return Math.min(total, discountType.value);
}

async function listInvoices(schoolId, { q, cls, status, branchId } = {}) {
  const where = { schoolId, ...branchFilter(branchId) };
  if (cls) where.cls = trimmed(cls);
  if (status) where.status = trimmed(status);
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

  const rows = await prisma.feeInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeInvoice);
}

async function createInvoice(schoolId, input) {
  let studentId = input.studentId || null;
  let student = trimmed(input.student);
  let studentCode = trimmed(input.studentCode) || null;
  let cls = trimmed(input.cls);
  let section = trimmed(input.section);
  let branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  let session = trimmed(input.session) || null;

  if (studentId) {
    const st = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
    if (!st) throw badRequest('Student not found.');
    student = st.name;
    studentCode = st.studentId || null;
    cls = st.cls;
    section = st.section;
    branchId = branchId || st.branchId || null;
    if (!session) session = st.session || null;
  }

  if (!student) throw badRequest('Student is required.');
  if (!cls) throw badRequest('Class is required.');
  if (!section) throw badRequest('Section is required.');

  const period = trimmed(input.period) || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const issue = trimmed(input.issue) || new Date().toISOString().slice(0, 10);
  const due = trimmed(input.due) || issue;

  if (!session) session = '2025-2026';
  let lines = Array.isArray(input.lines) ? input.lines : [];

  // Prefer class fee structure amounts over catalog (particular) defaults.
  // Particulars are templates (often amount 0); structure holds per-class fees.
  if (lines.length === 0 && (input.useStructure || (Array.isArray(input.particularIds) && input.particularIds.length))) {
    let structure = await prisma.feeStructure.findMany({
      where: { schoolId, session, cls, section },
    });
    // Fall back to any section for this class if exact section has no lines.
    if (structure.length === 0) {
      const all = await prisma.feeStructure.findMany({ where: { schoolId, session, cls } });
      const seen = new Set();
      structure = all.filter((s) => {
        const key = s.particularId || s.particular;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (Array.isArray(input.particularIds) && input.particularIds.length) {
      const idSet = new Set(input.particularIds);
      const byId = structure.filter((s) => s.particularId && idSet.has(s.particularId));
      if (byId.length) {
        structure = byId;
      } else {
        const particulars = await prisma.feeParticular.findMany({
          where: { schoolId, id: { in: input.particularIds } },
        });
        const names = new Set(particulars.map((p) => p.particular));
        structure = structure.filter((s) => names.has(s.particular));
      }
    }

    lines = structure.map((s) => ({
      particularId: s.particularId,
      particular: s.particular,
      amount: s.amount,
      frequency: s.frequency,
    }));
  }

  // Last resort: catalog particular amounts (only when no structure lines exist)
  if (lines.length === 0 && Array.isArray(input.particularIds) && input.particularIds.length) {
    const particulars = await prisma.feeParticular.findMany({
      where: { schoolId, id: { in: input.particularIds } },
    });
    lines = particulars.map((p) => ({
      particularId: p.id,
      particular: p.particular,
      amount: p.amount,
      frequency: p.frequency,
    }));
  }

  lines = lines.map((l) => ({
    particularId: l.particularId || null,
    particular: trimmed(l.particular),
    amount: toInt(l.amount),
    frequency: trimmed(l.frequency) || 'Monthly',
  })).filter((l) => l.particular);

  if (lines.length === 0) throw badRequest('At least one fee line is required.');

  const total = lines.reduce((a, l) => a + l.amount, 0);

  let discountType = null;
  if (input.discountTypeId) {
    discountType = await prisma.discountType.findFirst({
      where: { id: input.discountTypeId, schoolId, status: 'Active' },
    });
  }

  const discount = computeDiscountAmount(total, discountType, input.discount);
  const paid = toInt(input.paid);
  const { balance, status } = deriveInvoiceStatus({ total, discount, paid, due, status: input.status });
  const invoiceNo = trimmed(input.invoiceNo) || (await nextInvoiceNo(schoolId));

  const row = await prisma.feeInvoice.create({
    data: {
      schoolId,
      branchId,
      invoiceNo,
      studentId,
      student,
      studentCode,
      cls,
      section,
      session,
      period,
      issue,
      due,
      total,
      discount,
      paid,
      balance,
      status,
      discountTypeId: discountType?.id || null,
      discountName: discountType?.name || null,
      lines,
    },
  });

  return serializeInvoice(row);
}

async function updateInvoice(schoolId, id, input) {
  const existing = await prisma.feeInvoice.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Invoice not found.');

  // Paid / Partially Paid status (and paid amount) must come from recordPayment /
  // collectPayment — never from a manual status override.
  if (input.status !== undefined) {
    const nextStatus = trimmed(input.status);
    if (nextStatus === 'Paid' || nextStatus === 'Partially Paid') {
      throw badRequest(
        'Cannot mark an invoice as paid manually. Record a fee payment to update payment status.'
      );
    }
  }
  if (input.paid !== undefined && toInt(input.paid) !== existing.paid) {
    throw badRequest(
      'Cannot change paid amount directly. Record a fee payment to update collections.'
    );
  }

  const data = {};
  if (input.period !== undefined) data.period = trimmed(input.period);
  if (input.issue !== undefined) data.issue = trimmed(input.issue);
  if (input.due !== undefined) data.due = trimmed(input.due);
  if (input.discount !== undefined) data.discount = toInt(input.discount);
  if (input.total !== undefined) data.total = toInt(input.total);
  if (input.session !== undefined) data.session = trimmed(input.session) || null;
  if (input.lines !== undefined) data.lines = Array.isArray(input.lines) ? input.lines : existing.lines;

  const total = data.total ?? existing.total;
  const discount = data.discount ?? existing.discount;
  const paid = existing.paid;
  const due = data.due ?? existing.due;

  if (input.status !== undefined && INVOICE_STATUSES.has(trimmed(input.status))) {
    const nextStatus = trimmed(input.status);
    // Allow Overdue / Pending adjustments only when consistent with balances.
    const derived = deriveInvoiceStatus({ total, discount, paid, due });
    if (nextStatus === 'Overdue' && derived.balance > 0) {
      data.status = 'Overdue';
      data.balance = derived.balance;
    } else if (nextStatus === 'Pending' && paid === 0 && derived.balance > 0) {
      data.status = derived.status === 'Overdue' ? 'Overdue' : 'Pending';
      data.balance = derived.balance;
    } else {
      data.balance = derived.balance;
      data.status = derived.status;
    }
  } else {
    const derived = deriveInvoiceStatus({ total, discount, paid, due });
    data.balance = derived.balance;
    data.status = derived.status;
  }

  return serializeInvoice(await prisma.feeInvoice.update({ where: { id }, data }));
}

/**
 * Record a payment — delegates to the shared fee-payment service so receipts,
 * vouchers and journal entries stay consistent with receivables collection.
 */
async function recordPayment(schoolId, id, input = {}, auth = {}) {
  const feePaymentService = require('./fee-payment.service');
  return feePaymentService.collectPayment(schoolId, id, input, auth);
}

async function deleteInvoice(schoolId, id) {
  const existing = await prisma.feeInvoice.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Invoice not found.');
  await prisma.feeInvoice.delete({ where: { id } });
  return { id, deleted: true };
}

/* ── Voucher template (editable layout) ──────────────────── */

const DEFAULT_VOUCHER_TEMPLATE = {
  title: 'FEE VOUCHER',
  headerNote: '',
  footerNote: 'This is a computer-generated fee voucher. Please retain for your records.',
  instructions: 'Deposit the amount in the designated bank and submit the school copy at the accounts office.',
  bankName: '',
  bankAccountTitle: '',
  bankAccountNo: '',
  bankBranch: '',
  signatureLeft: 'Received By',
  signatureCenter: 'Cashier',
  signatureRight: 'Authorized Signatory',
  copyBank: 'BANK COPY',
  copyStudent: 'STUDENT COPY',
  copySchool: 'SCHOOL COPY',
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWebsite: true,
  showDiscount: true,
  showPaidBalance: true,
  accentColor: '#1e3a8a',
};

function normalizeVoucherTemplate(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...DEFAULT_VOUCHER_TEMPLATE,
    ...src,
    showLogo: src.showLogo !== false,
    showAddress: src.showAddress !== false,
    showPhone: src.showPhone !== false,
    showEmail: src.showEmail !== false,
    showWebsite: src.showWebsite !== false,
    showDiscount: src.showDiscount !== false,
    showPaidBalance: src.showPaidBalance !== false,
  };
}

async function getVoucherTemplate(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      feeVoucherTemplate: true,
      name: true,
      shortName: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      logoUrl: true,
      principal: true,
    },
  });
  if (!school) throw notFound('School not found.');

  return {
    template: normalizeVoucherTemplate(school.feeVoucherTemplate),
    school: {
      name: school.name,
      shortName: school.shortName,
      address: school.address,
      phone: school.phone,
      email: school.email,
      website: school.website,
      logoUrl: school.logoUrl,
      principal: school.principal,
    },
  };
}

async function updateVoucherTemplate(schoolId, input) {
  const current = await getVoucherTemplate(schoolId);
  const next = normalizeVoucherTemplate({
    ...current.template,
    ...(input && typeof input === 'object' ? input : {}),
  });

  await prisma.school.update({
    where: { id: schoolId },
    data: { feeVoucherTemplate: next },
  });

  return getVoucherTemplate(schoolId);
}

module.exports = {
  listParticulars,
  createParticular,
  updateParticular,
  deleteParticular,
  listStructure,
  createStructureLine,
  copyStructure,
  deleteStructureLine,
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  listInvoices,
  createInvoice,
  updateInvoice,
  recordPayment,
  deleteInvoice,
  getVoucherTemplate,
  updateVoucherTemplate,
  DEFAULT_VOUCHER_TEMPLATE,
};
