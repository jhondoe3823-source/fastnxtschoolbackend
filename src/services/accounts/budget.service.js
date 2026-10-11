/**
 * Department Budgets Service.
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { badRequest, notFound } = require('../../utils/errors');
const { branchWhere, resolveBranchId } = require('./branch-scope');

const trimmed = (value) => String(value ?? '').trim();
const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));

/** Seed default sample budgets if none exist. */
const DEFAULT_BUDGETS = [
  { name: 'Academic Operations Budget', year: '2026-2027', department: 'School Operations', amount: 5000000, spent: 3250000 },
  { name: 'Sports & Co-Curricular', year: '2026-2027', department: 'Activities', amount: 800000, spent: 320000 },
  { name: 'IT Infrastructure & Lab', year: '2026-2027', department: 'Technology', amount: 1500000, spent: 1420000 },
  { name: 'Transport Fleet Operations', year: '2026-2027', department: 'Transport', amount: 2200000, spent: 900000 },
];

async function ensureDefaultBudgets(schoolId) {
  const count = await prisma.budget.count({ where: { schoolId } });
  if (count > 0) return;

  for (const b of DEFAULT_BUDGETS) {
    await prisma.budget.create({
      data: {
        schoolId,
        name: b.name,
        year: b.year,
        department: b.department,
        amount: b.amount,
        spent: b.spent,
        status: b.spent > b.amount ? 'Over Budget' : (b.spent === b.amount ? 'Completed' : 'Active'),
      },
    }).catch(() => {});
  }
}

function deriveBudgetStatus(amount, spent, currentStatus) {
  if (currentStatus === 'Inactive') return 'Inactive';
  if (spent > amount) return 'Over Budget';
  if (spent >= amount && amount > 0) return 'Completed';
  return 'Active';
}

/** List budgets with dynamic remaining balance. */
async function listBudgets(schoolId, { year, status, department, q, branchId } = {}) {
  await ensureDefaultBudgets(schoolId);

  const where = { schoolId, ...branchWhere(branchId) };
  if (year) where.year = year;
  if (status) where.status = status;
  if (department) where.department = department;

  if (q) {
    const term = trimmed(q);
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { department: { contains: term, mode: 'insensitive' } },
      { year: { contains: term, mode: 'insensitive' } },
    ];
  }

  const budgets = await prisma.budget.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return budgets.map((b) => {
    const remaining = b.amount - b.spent;
    const computedStatus = deriveBudgetStatus(b.amount, b.spent, b.status);
    return {
      id: b.id,
      branchId: b.branchId || null,
      name: b.name,
      year: b.year,
      department: b.department,
      budget: b.amount,
      actual: b.spent,
      remaining,
      status: computedStatus,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });
}

/** Create a budget. */
async function createBudget(schoolId, input) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Budget name is required.');

  const department = trimmed(input.department) || 'General';
  const year = trimmed(input.year) || '2026-2027';
  const amount = toInt(input.budget || input.amount);
  if (amount <= 0) throw badRequest('Budget amount must be positive.');

  const spent = toInt(input.actual || input.spent);
  const status = deriveBudgetStatus(amount, spent, trimmed(input.status));
  const resolvedBranchId = await resolveBranchId(schoolId, input.branchId);

  const budget = await prisma.budget.create({
    data: {
      schoolId,
      branchId: resolvedBranchId,
      name,
      department,
      year,
      amount,
      spent,
      status,
    },
  });

  return {
    id: budget.id,
    branchId: budget.branchId || null,
    name: budget.name,
    year: budget.year,
    department: budget.department,
    budget: budget.amount,
    actual: budget.spent,
    remaining: budget.amount - budget.spent,
    status: budget.status,
  };
}

/** Update a budget. */
async function updateBudget(schoolId, id, input) {
  const existing = await prisma.budget.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Budget not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.department !== undefined) data.department = trimmed(input.department);
  if (input.year !== undefined) data.year = trimmed(input.year);
  if (input.budget !== undefined || input.amount !== undefined) {
    data.amount = toInt(input.budget || input.amount);
  }
  if (input.actual !== undefined || input.spent !== undefined) {
    data.spent = toInt(input.actual || input.spent);
  }

  const finalAmount = data.amount ?? existing.amount;
  const finalSpent = data.spent ?? existing.spent;
  data.status = deriveBudgetStatus(finalAmount, finalSpent, input.status || existing.status);

  const updated = await prisma.budget.update({
    where: { id },
    data,
  });

  return {
    id: updated.id,
    name: updated.name,
    year: updated.year,
    department: updated.department,
    budget: updated.amount,
    actual: updated.spent,
    remaining: updated.amount - updated.spent,
    status: updated.status,
  };
}

/** Delete a budget. */
async function deleteBudget(schoolId, id) {
  const existing = await prisma.budget.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Budget not found.');

  await prisma.budget.delete({ where: { id } });
  return { id, deleted: true };
}

module.exports = {
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
};
