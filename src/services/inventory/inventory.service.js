/**
 * Inventory service — CRUD + stock adjustment for consumable items.
 * Derives status from qty vs reorder level. Purchases (create / positive
 * adjust) can post a Payment voucher to Inventory Stock / Cash-Bank.
 * Consumptions (negative adjust) post a journal entry:
 *   Debit Stationery (expense), Credit Inventory Stock.
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');
const logger = require('../../utils/logger');
const accountService = require('../accounts/account.service');

const trimmed = (val) => String(val ?? '').trim();
const toInt = (val) => Math.max(0, Math.round(Number(val) || 0));

/* ------------------------------------------------------------------ helpers */

function deriveStatus(qty, reorder) {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= reorder) return 'Low Stock';
  return 'In Stock';
}

function serialize(r) {
  return {
    id: r.id,
    branchId: r.branchId || null,
    item: r.item,
    category: r.category,
    qty: r.qty ?? 0,
    unit: r.unit || 'pc',
    reorder: r.reorder ?? 0,
    supplier: r.supplier || '',
    value: r.value ?? 0,
    status: r.status || 'In Stock',
    voucherId: r.voucherId || null,
    voucherNo: r.voucherNo || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function resolveBranchId(schoolId, branchId) {
  if (branchId && branchId !== 'all') {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, schoolId } });
    if (!branch) throw badRequest('Selected branch was not found for this school.');
    return branch.id;
  }
  const main = await prisma.branch.findFirst({
    where: { schoolId },
    orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
  });
  if (!main) throw badRequest('No campus/branch is configured. Add a branch first.');
  return main.id;
}

async function resolveInventoryAccount(schoolId, accountId) {
  if (accountId) {
    const acc = await prisma.account.findFirst({ where: { id: accountId, schoolId, isActive: true } });
    if (acc) return acc;
  }
  return accountService.findAccountByCodeOrName(schoolId, {
    code: '1101',
    name: 'Inventory Stock',
  });
}

async function resolveExpenseAccount(schoolId) {
  return accountService.findAccountByCodeOrName(schoolId, {
    code: '5004',
    name: 'Stationery',
  });
}

/** Payment voucher: Debit Inventory Stock, Credit Cash/Bank. */
async function postPurchaseVoucher(schoolId, item, amount, input = {}, auth = {}) {
  const value = toInt(amount);
  if (value <= 0) return null;

  await accountService.ensureDefaultChartOfAccounts(schoolId);
  const stockAcc = await resolveInventoryAccount(schoolId, trimmed(input.accountId));
  if (!stockAcc) throw badRequest('Inventory Stock ledger account is missing from the chart of accounts.');

  const voucherService = require('../accounts/voucher.service');
  return voucherService.createVoucher(
    schoolId,
    {
      kind: 'Payment',
      party: trimmed(input.supplier) || item.supplier || item.item,
      accountId: stockAcc.id,
      amount: value,
      method: trimmed(input.method) || 'Cash',
      cashBankAccountId: trimmed(input.cashBankAccountId) || undefined,
      reference: `INV-${item.id.slice(-6).toUpperCase()}`,
      status: 'Posted',
      branchId: item.branchId || input.branchId || null,
    },
    auth
  );
}

/**
 * Consumption journal: Debit expense, Credit Inventory Stock
 * (no cash movement — stock used internally).
 */
async function postConsumptionJournal(schoolId, item, amount, auth = {}) {
  const value = toInt(amount);
  if (value <= 0) return null;

  await accountService.ensureDefaultChartOfAccounts(schoolId);
  const stockAcc = await resolveInventoryAccount(schoolId);
  const expenseAcc = await resolveExpenseAccount(schoolId);
  if (!stockAcc || !expenseAcc) {
    throw badRequest('Inventory Stock or Stationery ledger account is missing.');
  }

  const journalService = require('../accounts/journal.service');
  return journalService.createEntry(
    schoolId,
    {
      description: `Inventory consumed: ${item.item}`,
      reference: `INV-${item.id.slice(-6).toUpperCase()}`,
      status: 'Posted',
      notes: `Stock adjustment for ${item.item}`,
      branchId: item.branchId || null,
      lines: [
        {
          accountId: expenseAcc.id,
          description: `Consumed ${item.item}`,
          debit: value,
          credit: 0,
        },
        {
          accountId: stockAcc.id,
          description: `Consumed ${item.item}`,
          debit: 0,
          credit: value,
        },
      ],
    },
    auth
  );
}

/* ------------------------------------------------------------------- CRUD */

async function listInventory(schoolId, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.inventoryItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getInventoryItem(schoolId, id) {
  const row = await prisma.inventoryItem.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Inventory item not found.');
  return serialize(row);
}

async function createInventoryItem(schoolId, input, auth = {}) {
  const item = trimmed(input.item);
  if (!item) throw badRequest('Item name is required.');
  const category = trimmed(input.category);
  if (!category) throw badRequest('Category is required.');

  const qty = toInt(input.qty);
  const reorder = toInt(input.reorder);
  const value = toInt(input.value);
  const branchId = await resolveBranchId(schoolId, input.branchId);
  const postToAccounts = input.postToAccounts !== false && input.postToAccounts !== 'false';

  let row = await prisma.inventoryItem.create({
    data: {
      schoolId,
      branchId,
      item,
      category,
      qty,
      unit: trimmed(input.unit) || 'pc',
      reorder,
      supplier: trimmed(input.supplier),
      value,
      status: deriveStatus(qty, reorder),
    },
  });

  if (postToAccounts && value > 0) {
    try {
      const voucher = await postPurchaseVoucher(schoolId, row, value, input, auth);
      if (voucher) {
        row = await prisma.inventoryItem.update({
          where: { id: row.id },
          data: { voucherId: voucher.id, voucherNo: voucher.no || '' },
        });
      }
    } catch (e) {
      logger.warn(`Inventory ${row.item} created but accounting post failed: ${e.message}`);
    }
  }

  return serialize(row);
}

async function updateInventoryItem(schoolId, id, input) {
  const existing = await prisma.inventoryItem.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Inventory item not found.');

  const data = {};
  if (input.item !== undefined) data.item = trimmed(input.item);
  if (input.category !== undefined) data.category = trimmed(input.category);
  if (input.unit !== undefined) data.unit = trimmed(input.unit) || 'pc';
  if (input.supplier !== undefined) data.supplier = trimmed(input.supplier);
  if (input.value !== undefined) data.value = toInt(input.value);
  if (input.branchId !== undefined) {
    data.branchId = await resolveBranchId(schoolId, input.branchId);
  }

  const newQty = input.qty !== undefined ? toInt(input.qty) : existing.qty;
  const newReorder = input.reorder !== undefined ? toInt(input.reorder) : existing.reorder;
  if (input.qty !== undefined) data.qty = newQty;
  if (input.reorder !== undefined) data.reorder = newReorder;
  if (input.qty !== undefined || input.reorder !== undefined) {
    data.status = deriveStatus(newQty, newReorder);
  }

  const updated = await prisma.inventoryItem.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

/** Adjust stock quantity by a delta (positive = add, negative = consume). */
async function adjustStock(schoolId, id, input, auth = {}) {
  const existing = await prisma.inventoryItem.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Inventory item not found.');

  const delta = parseInt(input.delta, 10);
  if (isNaN(delta) || delta === 0) throw badRequest('Delta must be a non-zero integer.');

  const newQty = Math.max(0, existing.qty + delta);
  const newStatus = deriveStatus(newQty, existing.reorder);
  const postToAccounts = input.postToAccounts !== false && input.postToAccounts !== 'false';

  // Value change: use explicit amount, else scale by per-unit, else leave as-is for consume
  let newValue = existing.value;
  let valueDelta = 0;
  if (input.amount !== undefined && input.amount !== null && input.amount !== '') {
    valueDelta = toInt(input.amount);
    if (delta > 0) newValue = existing.value + valueDelta;
    else newValue = Math.max(0, existing.value - valueDelta);
  } else if (existing.qty > 0) {
    const perUnit = existing.value / existing.qty;
    newValue = Math.round(perUnit * newQty);
    valueDelta = Math.abs(newValue - existing.value);
  } else if (delta > 0 && input.unitCost !== undefined) {
    valueDelta = toInt(input.unitCost) * delta;
    newValue = existing.value + valueDelta;
  }
  if (newQty === 0) {
    valueDelta = existing.value;
    newValue = 0;
  }

  let updated = await prisma.inventoryItem.update({
    where: { id: existing.id },
    data: { qty: newQty, status: newStatus, value: newValue },
  });

  if (postToAccounts && valueDelta > 0) {
    try {
      if (delta > 0) {
        const voucher = await postPurchaseVoucher(schoolId, updated, valueDelta, {
          ...input,
          supplier: input.supplier || existing.supplier,
        }, auth);
        if (voucher) {
          updated = await prisma.inventoryItem.update({
            where: { id: updated.id },
            data: { voucherId: voucher.id, voucherNo: voucher.no || '' },
          });
        }
      } else {
        await postConsumptionJournal(schoolId, updated, valueDelta, auth);
      }
    } catch (e) {
      logger.warn(`Stock adjust for ${existing.item} saved but accounting post failed: ${e.message}`);
    }
  }

  return serialize(updated);
}

async function deleteInventoryItem(schoolId, id) {
  const existing = await prisma.inventoryItem.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Inventory item not found.');
  await prisma.inventoryItem.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
};
