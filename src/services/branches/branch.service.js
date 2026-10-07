/**
 * Branch service — campus/branch management.
 *
 * A school can have multiple branches (campuses). Every school gets a default
 * "Main Campus" branch created during registration. Branches have their own
 * address, phone, and status (active/inactive).
 */

const prisma = require('../../config/database').prisma;
const logger = require('../../utils/logger');
const { conflict, notFound, badRequest } = require('../../utils/errors');
const { ERROR_CODES } = require('../../constants');

/** Columns the client is allowed to see. */
const BRANCH_FIELDS = [
  'id',
  'schoolId',
  'name',
  'code',
  'address',
  'city',
  'phone',
  'status',
  'isMain',
  'createdAt',
  'updatedAt',
];

/** Fields the client can write (partial update allowed). */
const WRITABLE_FIELDS = {
  name: { required: true, maxLength: 120 },
  code: { required: true, maxLength: 20 },
  address: { maxLength: 300 },
  city: { maxLength: 80 },
  phone: { maxLength: 40 },
  status: { required: true },
  isMain: { required: false },
};

const trimmed = (value) => String(value ?? '').trim();

/** The canonical branch payload. */
function serializeBranch(branch) {
  if (!branch) return null;

  const payload = { id: branch.id };

  for (const field of BRANCH_FIELDS) {
    if (field === 'id') continue;
    const value = branch[field];
    payload[field] = value === undefined ? null : value;
  }

  return payload;
}

/** List all branches for a school. */
async function listBranches(schoolId) {
  const branches = await prisma.branch.findMany({
    where: { schoolId },
    orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
  });

  return branches.map(serializeBranch);
}

/** Get a single branch by ID (must belong to the school). */
async function getBranch(schoolId, branchId) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, schoolId },
  });

  if (!branch) {
    throw notFound('Branch not found or does not belong to your school.');
  }

  return serializeBranch(branch);
}

/** Create a new branch for a school. */
async function createBranch(schoolId, input) {
  const name = trimmed(input.name);
  const code = trimmed(input.code).toUpperCase();

  // Check if code is already used in this school
  const existing = await prisma.branch.findFirst({
    where: { schoolId, code },
  });

  if (existing) {
    throw conflict(
      'A branch with this code already exists in your school.',
      ERROR_CODES.CODE_IN_USE
    );
  }

  const branch = await prisma.branch.create({
    data: {
      schoolId,
      name,
      code,
      address: trimmed(input.address) || null,
      city: trimmed(input.city) || null,
      phone: trimmed(input.phone) || null,
      status: input.status || 'ACTIVE',
      isMain: false, // Only the first branch can be main
    },
  });

  logger.info(`Created branch "${branch.name}" (${branch.code}) for school ${schoolId}.`);
  return serializeBranch(branch);
}

/** Update a branch (partial). */
async function updateBranch(schoolId, branchId, input) {
  const existing = await prisma.branch.findFirst({
    where: { id: branchId, schoolId },
  });

  if (!existing) {
    throw notFound('Branch not found or does not belong to your school.');
  }

  const data = {};

  for (const [field, rules] of Object.entries(WRITABLE_FIELDS)) {
    if (input[field] === undefined) continue;

    const value = field === 'code' ? trimmed(input[field]).toUpperCase() : trimmed(input[field]);
    data[field] = value === '' && !rules.required ? null : value;
  }

  if (Object.keys(data).length === 0) {
    return serializeBranch(existing);
  }

  // Check code uniqueness if being changed
  if (data.code && data.code !== existing.code) {
    const taken = await prisma.branch.findFirst({
      where: { schoolId, code: data.code },
    });

    if (taken && taken.id !== branchId) {
      throw conflict(
        'A branch with this code already exists in your school.',
        ERROR_CODES.CODE_IN_USE
      );
    }
  }

  // Prevent changing isMain to false if it's the only active branch
  if (data.isMain === false && existing.isMain) {
    const otherActiveBranches = await prisma.branch.count({
      where: { schoolId, id: { not: branchId }, status: 'ACTIVE' },
    });

    if (otherActiveBranches === 0) {
      throw badRequest('Cannot deactivate the main branch when it is the only active branch.');
    }
  }

  const updated = await prisma.branch.update({
    where: { id: branchId },
    data,
  });

  logger.info(`Updated branch "${updated.name}" (${updated.id}).`);
  return serializeBranch(updated);
}

/** Delete a branch. */
async function deleteBranch(schoolId, branchId) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, schoolId },
  });

  if (!branch) {
    throw notFound('Branch not found or does not belong to your school.');
  }

  // Prevent deleting the main branch
  if (branch.isMain) {
    throw badRequest('Cannot delete the main branch.');
  }

  await prisma.branch.delete({
    where: { id: branchId },
  });

  logger.info(`Deleted branch "${branch.name}" (${branchId}).`);
}

/** Update branch status (activate/deactivate). */
async function updateBranchStatus(schoolId, branchId, status) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, schoolId },
  });

  if (!branch) {
    throw notFound('Branch not found or does not belong to your school.');
  }

  // Prevent deactivating the main branch if it's the only active one
  if (status === 'INACTIVE' && branch.isMain) {
    const otherActiveBranches = await prisma.branch.count({
      where: { schoolId, id: { not: branchId }, status: 'ACTIVE' },
    });

    if (otherActiveBranches === 0) {
      throw badRequest('Cannot deactivate the main branch when it is the only active branch.');
    }
  }

  const updated = await prisma.branch.update({
    where: { id: branchId },
    data: { status },
  });

  logger.info(`Updated branch "${updated.name}" status to ${status}.`);
  return serializeBranch(updated);
}

module.exports = {
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  updateBranchStatus,
  serializeBranch,
};
