/**
 * Role service — manage role permissions per school.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');

const DEFAULT_ROLES = [
  'Super Admin',
  'Owner',
  'Principal',
  'Branch Admin',
  'Academic Coordinator',
  'Teacher',
  'Accountant',
  'HR Manager',
  'Receptionist',
  'Librarian',
  'Transport Manager',
  'Hostel Warden',
  'Parent',
  'Student',
];

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
    return customMap[roleName] || null;
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
