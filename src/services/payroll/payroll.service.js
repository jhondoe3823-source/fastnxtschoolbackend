/**
 * Payroll — employee salary structures, monthly runs, and payslips.
 *
 * Cycle: set structures → create Draft run → generate slips → Approve → Mark Paid
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest, forbidden, conflict } = require('../../utils/errors');
const { PANELS } = require('../../constants/roles');

const RUN_STATUSES = new Set(['Draft', 'Approved', 'Paid']);
const STRUCTURE_STATUSES = new Set(['Active', 'Inactive']);

const trimmed = (val) => String(val ?? '').trim();
const toInt = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
};

function isAdminAuth(auth) {
  const panel = String(auth?.panel || '').toLowerCase();
  const role = String(auth?.role || '').toLowerCase();
  return panel === PANELS.ADMIN || role === 'admin' || role === 'owner' || role === 'principal';
}

function isTeacherAuth(auth) {
  const panel = String(auth?.panel || '').toLowerCase();
  const role = String(auth?.role || '').toLowerCase();
  return panel === PANELS.TEACHER || role.includes('teacher') || role.includes('staff') || role.includes('employee');
}

function requireAdmin(auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only administrators can manage payroll.');
}

function normalizeMonth(value) {
  const month = trimmed(value);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw badRequest('Month must be in YYYY-MM format.');
  }
  const m = Number(month.slice(5, 7));
  if (m < 1 || m > 12) throw badRequest('Month must be between 01 and 12.');
  return month;
}

function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${label} Payroll`;
}

function computeAmounts(input) {
  const basic = toInt(input.basic);
  const houseRent = toInt(input.houseRent);
  const transport = toInt(input.transport);
  const medical = toInt(input.medical);
  const otherAllow = toInt(input.otherAllow);
  const tax = toInt(input.tax);
  const providentFund = toInt(input.providentFund);
  const otherDeduct = toInt(input.otherDeduct);
  const allowances = houseRent + transport + medical + otherAllow;
  const deductions = tax + providentFund + otherDeduct;
  const gross = basic + allowances;
  const net = Math.max(0, gross - deductions);
  return {
    basic,
    houseRent,
    transport,
    medical,
    otherAllow,
    allowances,
    tax,
    providentFund,
    otherDeduct,
    deductions,
    gross,
    net,
  };
}

function serializeStructure(row) {
  const amounts = computeAmounts(row);
  return {
    id: row.id,
    branchId: row.branchId || null,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeCode: row.employeeCode || '',
    designation: row.designation || '',
    department: row.department || '',
    ...amounts,
    effectiveFrom: row.effectiveFrom || null,
    status: row.status,
    notes: row.notes || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeRun(row) {
  return {
    id: row.id,
    branchId: row.branchId || null,
    month: row.month,
    title: row.title || monthTitle(row.month),
    status: row.status,
    totalGross: row.totalGross || 0,
    totalDeductions: row.totalDeductions || 0,
    totalNet: row.totalNet || 0,
    employeeCount: row.employeeCount || 0,
    notes: row.notes || '',
    approvedAt: row.approvedAt || null,
    paidAt: row.paidAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializePayslip(row) {
  return {
    id: row.id,
    branchId: row.branchId || null,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeCode: row.employeeCode || '',
    designation: row.designation || '',
    department: row.department || '',
    month: row.month,
    basic: row.basic || 0,
    houseRent: row.houseRent || 0,
    transport: row.transport || 0,
    medical: row.medical || 0,
    otherAllow: row.otherAllow || 0,
    allowances: row.allowances || 0,
    tax: row.tax || 0,
    providentFund: row.providentFund || 0,
    otherDeduct: row.otherDeduct || 0,
    deductions: row.deductions || 0,
    gross: row.gross || 0,
    net: row.net || 0,
    status: row.status,
    note: row.note || '',
    paidAt: row.paidAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveUser(schoolId, auth) {
  if (!auth?.userId) return null;
  return prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { id: true, name: true, email: true, panel: true, role: true },
  });
}

async function resolveEmployeeForUser(schoolId, auth) {
  const user = await resolveUser(schoolId, auth);
  if (!user) return null;

  const employees = await prisma.employee.findMany({
    where: { schoolId, status: 'Active' },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      designation: true,
      department: true,
      branchId: true,
    },
  });

  const emailLower = (user.email || '').toLowerCase();
  const nameLower = (user.name || '').toLowerCase();

  return (
    employees.find((e) => (e.email || '').toLowerCase() === emailLower) ||
    employees.find((e) => (e.name || '').toLowerCase() === nameLower) ||
    null
  );
}

async function refreshRunTotals(runId) {
  const slips = await prisma.payslip.findMany({ where: { payrollRunId: runId } });
  const totalGross = slips.reduce((s, r) => s + (r.gross || 0), 0);
  const totalDeductions = slips.reduce((s, r) => s + (r.deductions || 0), 0);
  const totalNet = slips.reduce((s, r) => s + (r.net || 0), 0);
  return prisma.payrollRun.update({
    where: { id: runId },
    data: {
      totalGross,
      totalDeductions,
      totalNet,
      employeeCount: slips.length,
    },
  });
}

/* ── Salary structures ───────────────────────────────────────────────────── */

async function listStructures(schoolId, { branchId, status, q } = {}, auth = {}) {
  requireAdmin(auth);
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status && STRUCTURE_STATUSES.has(status)) where.status = status;
  if (q) {
    const query = trimmed(q);
    where.OR = [
      { employeeName: { contains: query, mode: 'insensitive' } },
      { employeeCode: { contains: query, mode: 'insensitive' } },
      { designation: { contains: query, mode: 'insensitive' } },
      { department: { contains: query, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.employeeSalary.findMany({
    where,
    orderBy: { employeeName: 'asc' },
  });
  return rows.map(serializeStructure);
}

async function upsertStructure(schoolId, input, auth = {}) {
  requireAdmin(auth);

  const employeeId = trimmed(input.employeeId);
  if (!employeeId) throw badRequest('Employee is required.');

  const employee = await prisma.employee.findFirst({
    where: { schoolId, OR: [{ id: employeeId }, { employeeId }] },
  });
  if (!employee) throw notFound('Employee not found.');

  const amounts = computeAmounts(input);
  const status = trimmed(input.status) || 'Active';
  if (!STRUCTURE_STATUSES.has(status)) throw badRequest('Status must be Active or Inactive.');

  const data = {
    branchId: input.branchId && input.branchId !== 'all' ? input.branchId : employee.branchId || null,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.employeeId || '',
    designation: employee.designation || '',
    department: employee.department || '',
    ...amounts,
    houseRent: amounts.houseRent,
    transport: amounts.transport,
    medical: amounts.medical,
    otherAllow: amounts.otherAllow,
    tax: amounts.tax,
    providentFund: amounts.providentFund,
    otherDeduct: amounts.otherDeduct,
    basic: amounts.basic,
    effectiveFrom: trimmed(input.effectiveFrom) || null,
    status,
    notes: trimmed(input.notes) || null,
  };

  // Prisma model doesn't store allowances/gross/net — strip computed-only fields
  delete data.allowances;
  delete data.deductions;
  delete data.gross;
  delete data.net;

  const existing = await prisma.employeeSalary.findUnique({
    where: { schoolId_employeeId: { schoolId, employeeId: employee.id } },
  });

  const row = existing
    ? await prisma.employeeSalary.update({ where: { id: existing.id }, data })
    : await prisma.employeeSalary.create({ data: { schoolId, ...data } });

  logger.info(`Upserted salary structure for ${employee.name} (${employee.id}) in school ${schoolId}.`);
  return serializeStructure(row);
}

async function updateStructure(schoolId, id, input, auth = {}) {
  requireAdmin(auth);
  const existing = await prisma.employeeSalary.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Salary structure not found.');

  const amounts = computeAmounts({ ...existing, ...input });
  const data = {
    basic: amounts.basic,
    houseRent: amounts.houseRent,
    transport: amounts.transport,
    medical: amounts.medical,
    otherAllow: amounts.otherAllow,
    tax: amounts.tax,
    providentFund: amounts.providentFund,
    otherDeduct: amounts.otherDeduct,
  };

  if (input.status !== undefined) {
    const status = trimmed(input.status);
    if (!STRUCTURE_STATUSES.has(status)) throw badRequest('Status must be Active or Inactive.');
    data.status = status;
  }
  if (input.effectiveFrom !== undefined) data.effectiveFrom = trimmed(input.effectiveFrom) || null;
  if (input.notes !== undefined) data.notes = trimmed(input.notes) || null;
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  const updated = await prisma.employeeSalary.update({ where: { id: existing.id }, data });
  return serializeStructure(updated);
}

async function deleteStructure(schoolId, id, auth = {}) {
  requireAdmin(auth);
  const existing = await prisma.employeeSalary.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Salary structure not found.');
  await prisma.employeeSalary.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

/* ── Payroll runs ────────────────────────────────────────────────────────── */

async function listRuns(schoolId, { branchId, status, month } = {}, auth = {}) {
  requireAdmin(auth);
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status && RUN_STATUSES.has(status)) where.status = status;
  if (month) where.month = normalizeMonth(month);

  const rows = await prisma.payrollRun.findMany({
    where,
    orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializeRun);
}

async function getRun(schoolId, id, auth = {}) {
  requireAdmin(auth);
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id } });
  if (!run) throw notFound('Payroll run not found.');

  const payslips = await prisma.payslip.findMany({
    where: { schoolId, payrollRunId: id },
    orderBy: { employeeName: 'asc' },
  });

  return { run: serializeRun(run), payslips: payslips.map(serializePayslip) };
}

async function createRun(schoolId, input, auth = {}) {
  requireAdmin(auth);
  const month = normalizeMonth(input.month);
  const branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const duplicate = await prisma.payrollRun.findFirst({
    where: {
      schoolId,
      month,
      ...(branchId ? { branchId } : { branchId: null }),
    },
  });
  if (duplicate) {
    throw conflict(`A payroll cycle for ${month} already exists for this campus.`);
  }

  const run = await prisma.payrollRun.create({
    data: {
      schoolId,
      branchId,
      month,
      title: trimmed(input.title) || monthTitle(month),
      notes: trimmed(input.notes) || null,
      status: 'Draft',
    },
  });

  logger.info(`Created payroll run ${run.id} for ${month} (school ${schoolId}).`);
  return serializeRun(run);
}

async function generatePayslips(schoolId, runId, auth = {}) {
  requireAdmin(auth);
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id: runId } });
  if (!run) throw notFound('Payroll run not found.');
  if (run.status !== 'Draft') {
    throw badRequest('Payslips can only be generated while the cycle is Draft.');
  }

  const structureWhere = { schoolId, status: 'Active' };
  if (run.branchId) structureWhere.branchId = run.branchId;

  const structures = await prisma.employeeSalary.findMany({ where: structureWhere });
  if (structures.length === 0) {
    throw badRequest('No active salary structures found. Set employee salaries first.');
  }

  const existing = await prisma.payslip.findMany({
    where: { payrollRunId: run.id },
    select: { employeeId: true },
  });
  const already = new Set(existing.map((e) => e.employeeId));

  const toCreate = structures
    .filter((s) => !already.has(s.employeeId))
    .map((s) => {
      const amounts = computeAmounts(s);
      return {
        schoolId,
        branchId: run.branchId || s.branchId || null,
        payrollRunId: run.id,
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        employeeCode: s.employeeCode || '',
        designation: s.designation || '',
        department: s.department || '',
        month: run.month,
        basic: amounts.basic,
        houseRent: amounts.houseRent,
        transport: amounts.transport,
        medical: amounts.medical,
        otherAllow: amounts.otherAllow,
        allowances: amounts.allowances,
        tax: amounts.tax,
        providentFund: amounts.providentFund,
        otherDeduct: amounts.otherDeduct,
        deductions: amounts.deductions,
        gross: amounts.gross,
        net: amounts.net,
        status: 'Draft',
      };
    });

  if (toCreate.length > 0) {
    await prisma.payslip.createMany({ data: toCreate });
  }

  const updated = await refreshRunTotals(run.id);
  logger.info(
    `Generated ${toCreate.length} payslip(s) for payroll run ${run.id} (skipped ${already.size}).`
  );
  return serializeRun(updated);
}

async function approveRun(schoolId, runId, auth = {}) {
  requireAdmin(auth);
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id: runId } });
  if (!run) throw notFound('Payroll run not found.');
  if (run.status !== 'Draft') throw badRequest('Only Draft cycles can be approved.');

  const count = await prisma.payslip.count({ where: { payrollRunId: run.id } });
  if (count === 0) throw badRequest('Generate payslips before approving the cycle.');

  const now = new Date();
  await prisma.$transaction([
    prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'Approved', approvedAt: now },
    }),
    prisma.payslip.updateMany({
      where: { payrollRunId: run.id },
      data: { status: 'Approved' },
    }),
  ]);

  const refreshed = await prisma.payrollRun.findUnique({ where: { id: run.id } });
  return serializeRun(refreshed);
}

async function payRun(schoolId, runId, auth = {}) {
  requireAdmin(auth);
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id: runId } });
  if (!run) throw notFound('Payroll run not found.');
  if (run.status !== 'Approved') throw badRequest('Approve the cycle before marking it Paid.');

  const now = new Date();
  await prisma.$transaction([
    prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'Paid', paidAt: now },
    }),
    prisma.payslip.updateMany({
      where: { payrollRunId: run.id },
      data: { status: 'Paid', paidAt: now },
    }),
  ]);
  const refreshed = await prisma.payrollRun.findUnique({ where: { id: run.id } });
  logger.info(`Marked payroll run ${run.id} as Paid.`);

  if (run.totalNet > 0) {
    try {
      const voucherService = require('../accounts/voucher.service');
      await voucherService.createVoucher(
        schoolId,
        {
          kind: 'Payment',
          party: `Staff Payroll (${run.month})`,
          account: 'Salaries',
          amount: run.totalNet,
          method: 'Bank',
          reference: `PAYROLL-${run.month}`,
          status: 'Posted',
          branchId: run.branchId || null,
        },
        auth
      );
    } catch (e) {
      logger.warn(`Could not auto-post accounting voucher for payroll ${run.id}: ${e.message}`);
    }
  }

  return serializeRun(refreshed);
}

async function deleteRun(schoolId, runId, auth = {}) {
  requireAdmin(auth);
  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id: runId } });
  if (!run) throw notFound('Payroll run not found.');
  if (run.status !== 'Draft') throw badRequest('Only Draft cycles can be deleted.');

  await prisma.payrollRun.delete({ where: { id: run.id } });
  return { id: run.id, deleted: true };
}

/* ── Payslips ────────────────────────────────────────────────────────────── */

async function listPayslips(schoolId, { runId, branchId, month, status } = {}, auth = {}) {
  requireAdmin(auth);
  const where = { schoolId };
  if (runId) where.payrollRunId = runId;
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (month) where.month = normalizeMonth(month);
  if (status && RUN_STATUSES.has(status)) where.status = status;

  const rows = await prisma.payslip.findMany({
    where,
    orderBy: [{ month: 'desc' }, { employeeName: 'asc' }],
  });
  return rows.map(serializePayslip);
}

async function updatePayslip(schoolId, id, input, auth = {}) {
  requireAdmin(auth);
  const existing = await prisma.payslip.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Payslip not found.');

  const run = await prisma.payrollRun.findFirst({ where: { schoolId, id: existing.payrollRunId } });
  if (!run || run.status !== 'Draft') {
    throw badRequest('Payslips can only be edited while the cycle is Draft.');
  }

  const amounts = computeAmounts({ ...existing, ...input });
  const updated = await prisma.payslip.update({
    where: { id: existing.id },
    data: {
      basic: amounts.basic,
      houseRent: amounts.houseRent,
      transport: amounts.transport,
      medical: amounts.medical,
      otherAllow: amounts.otherAllow,
      allowances: amounts.allowances,
      tax: amounts.tax,
      providentFund: amounts.providentFund,
      otherDeduct: amounts.otherDeduct,
      deductions: amounts.deductions,
      gross: amounts.gross,
      net: amounts.net,
      note: input.note !== undefined ? trimmed(input.note) || null : existing.note,
    },
  });

  await refreshRunTotals(run.id);
  return serializePayslip(updated);
}

/** Teacher (or linked employee) — their payslips month-wise. */
async function listMyPayslips(schoolId, auth = {}) {
  if (!isTeacherAuth(auth) && !isAdminAuth(auth)) {
    throw forbidden('Only staff can view personal salary records.');
  }

  const employee = await resolveEmployeeForUser(schoolId, auth);
  if (!employee) {
    throw badRequest('No employee profile is linked to your account.');
  }

  const rows = await prisma.payslip.findMany({
    where: {
      schoolId,
      employeeId: employee.id,
      status: { in: ['Approved', 'Paid'] },
    },
    orderBy: { month: 'desc' },
  });

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeId,
      designation: employee.designation,
      department: employee.department,
    },
    payslips: rows.map(serializePayslip),
  };
}

module.exports = {
  listStructures,
  upsertStructure,
  updateStructure,
  deleteStructure,
  listRuns,
  getRun,
  createRun,
  generatePayslips,
  approveRun,
  payRun,
  deleteRun,
  listPayslips,
  updatePayslip,
  listMyPayslips,
};
