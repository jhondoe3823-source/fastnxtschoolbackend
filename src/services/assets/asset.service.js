
const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');
const logger = require('../../utils/logger');
const accountService = require('../accounts/account.service');

const trimmed = (val) => String(val ?? '').trim();
const toInt = (val) => Math.max(0, Math.round(Number(val) || 0));


function serialize(r) {
  return {
    id: r.id,
    branchId: r.branchId || null,
    name: r.name,
    category: r.category,
    tag: r.tag,
    purchaseDate: r.purchaseDate || '',
    cost: r.cost ?? 0,
    location: r.location || '',
    assignee: r.assignee || '',
    warranty: r.warranty || '',
    status: r.status || 'In Use',
    notes: r.notes || '',
    voucherId: r.voucherId || null,
    voucherNo: r.voucherNo || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Generate the next AST-XXXX tag for this school. */
async function nextTag(schoolId) {
  const last = await prisma.asset.findFirst({
    where: { schoolId },
    orderBy: { tag: 'desc' },
    select: { tag: true },
  });
  if (!last) return 'AST-1001';
  const num = parseInt(String(last.tag).replace(/^AST-/i, ''), 10);
  return `AST-${(isNaN(num) ? 1000 : num) + 1}`;
}

/** Resolve a valid branch for this school (required for new records). */
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

/**
 * Post asset purchase as a Payment voucher:
 *   Debit Fixed Assets, Credit Cash/Bank
 */
async function postPurchaseVoucher(schoolId, asset, input = {}, auth = {}) {
  const cost = toInt(asset.cost);
  if (cost <= 0) return null;

  await accountService.ensureDefaultChartOfAccounts(schoolId);

  let accountId = trimmed(input.accountId);
  if (!accountId) {
    const fixed = await accountService.findAccountByCodeOrName(schoolId, {
      code: '1200',
      name: 'Fixed Assets',
    });
    if (!fixed) throw badRequest('Fixed Assets ledger account is missing from the chart of accounts.');
    accountId = fixed.id;
  }

  const voucherService = require('../accounts/voucher.service');
  const voucher = await voucherService.createVoucher(
    schoolId,
    {
      kind: 'Payment',
      party: trimmed(input.supplier) || asset.name,
      accountId,
      amount: cost,
      method: trimmed(input.method) || 'Cash',
      cashBankAccountId: trimmed(input.cashBankAccountId) || undefined,
      reference: asset.tag,
      date: asset.purchaseDate || undefined,
      status: 'Posted',
      branchId: asset.branchId || input.branchId || null,
    },
    auth
  );

  return voucher;
}

/* ------------------------------------------------------------------- CRUD */

async function listAssets(schoolId, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.asset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

async function getAsset(schoolId, id) {
  const row = await prisma.asset.findFirst({ where: { schoolId, id } });
  if (!row) throw notFound('Asset not found.');
  return serialize(row);
}

async function createAsset(schoolId, input, auth = {}) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Asset name is required.');
  const category = trimmed(input.category);
  if (!category) throw badRequest('Category is required.');

  const tag = trimmed(input.tag) || (await nextTag(schoolId));
  const existing = await prisma.asset.findUnique({
    where: { schoolId_tag: { schoolId, tag } },
  });
  if (existing) throw badRequest(`Tag "${tag}" is already in use.`);

  const branchId = await resolveBranchId(schoolId, input.branchId);
  const cost = toInt(input.cost);
  const postToAccounts = input.postToAccounts !== false && input.postToAccounts !== 'false';

  let row = await prisma.asset.create({
    data: {
      schoolId,
      branchId,
      name,
      category,
      tag,
      purchaseDate: trimmed(input.purchaseDate) || null,
      cost,
      location: trimmed(input.location),
      assignee: trimmed(input.assignee),
      warranty: trimmed(input.warranty),
      status: trimmed(input.status) || 'In Use',
      notes: trimmed(input.notes) || '',
    },
  });

  if (postToAccounts && cost > 0) {
    try {
      const voucher = await postPurchaseVoucher(schoolId, row, input, auth);
      if (voucher) {
        row = await prisma.asset.update({
          where: { id: row.id },
          data: { voucherId: voucher.id, voucherNo: voucher.no || '' },
        });
      }
    } catch (e) {
      // Keep the asset register row even if the ledger post fails (same pattern as payroll).
      logger.warn(`Asset ${row.tag} created but accounting post failed: ${e.message}`);
    }
  }

  return serialize(row);
}

async function updateAsset(schoolId, id, input) {
  const existing = await prisma.asset.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Asset not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.category !== undefined) data.category = trimmed(input.category);
  if (input.tag !== undefined) {
    const newTag = trimmed(input.tag);
    if (newTag !== existing.tag) {
      const dup = await prisma.asset.findUnique({
        where: { schoolId_tag: { schoolId, tag: newTag } },
      });
      if (dup) throw badRequest(`Tag "${newTag}" is already in use.`);
      data.tag = newTag;
    }
  }
  if (input.purchaseDate !== undefined) data.purchaseDate = trimmed(input.purchaseDate) || null;
  if (input.cost !== undefined) data.cost = toInt(input.cost);
  if (input.location !== undefined) data.location = trimmed(input.location);
  if (input.assignee !== undefined) data.assignee = trimmed(input.assignee);
  if (input.warranty !== undefined) data.warranty = trimmed(input.warranty);
  if (input.status !== undefined) data.status = trimmed(input.status) || 'In Use';
  if (input.notes !== undefined) data.notes = trimmed(input.notes);
  if (input.branchId !== undefined) {
    data.branchId = await resolveBranchId(schoolId, input.branchId);
  }

  const updated = await prisma.asset.update({ where: { id: existing.id }, data });
  return serialize(updated);
}

async function deleteAsset(schoolId, id) {
  const existing = await prisma.asset.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Asset not found.');
  await prisma.asset.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = { listAssets, getAsset, createAsset, updateAsset, deleteAsset };
