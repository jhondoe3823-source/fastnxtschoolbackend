/**
 * Role service — manage role permissions per school.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');

const DEFAULT_ROLES = [
  'Super Admin',
  'Owner',
  'Admin',
  'Branch Admin',
  'Account',
  'Accountant',
  'Admission',
  'HR',
  'Receptionist',
  'Teacher',
  'Student',
];

/** Legacy role strings mapped onto the canonical catalog names. */
function roleLookupKeys(roleName) {
  const name = String(roleName || '').trim();
  if (!name) return [];
  if (name === 'Administrator') return ['Admin', name];
  if (name === 'Accountant') return ['Account', 'Accountant'];
  if (name === 'Account') return ['Account', 'Accountant'];
  if (name === 'HR Manager') return ['HR', name];
  if (name === 'Principal' || name === 'Academic Coordinator') return ['Admin', name];
  return [name];
}

/** Get stored role permissions for a school. */
async function getRolePermissions(schoolId, roleName) {
  const records = await prisma.rolePermission.findMany({
    where: { schoolId },
  });

  const customMap = {};
  records.forEach((r) => {
    customMap[r.role] = r.permissions;
  });

  if (roleName) {
    for (const key of roleLookupKeys(roleName)) {
      if (customMap[key] && typeof customMap[key] === 'object') {
        return customMap[key];
      }
    }
    return null;
  }

  return customMap;
}

/** Save/update role permissions for a school. */
async function updateRolePermissions(schoolId, roleName, permissions) {
  const existing = await prisma.rolePermission.findUnique({
    where: {
      schoolId_role: {
        schoolId,
        role: roleName,
      },
    },
  });

  let record;
  if (existing) {
    record = await prisma.rolePermission.update({
      where: { id: existing.id },
      data: { permissions },
    });
  } else {
    record = await prisma.rolePermission.create({
      data: {
        schoolId,
        role: roleName,
        permissions,
      },
    });
  }

  logger.info(`Updated permissions for role "${roleName}" in school ${schoolId}.`);
  return { role: roleName, permissions: record.permissions };
}

module.exports = {
  DEFAULT_ROLES,
  getRolePermissions,
  updateRolePermissions,
};
