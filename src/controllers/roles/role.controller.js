/**
 * Role controller — HTTP handlers for role permissions.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const roleService = require('../../services/roles/role.service');

const getRolePermissions = asyncHandler(async (req, res) => {
  const permissions = await roleService.getRolePermissions(req.auth.schoolId, req.params.role);
  return ApiResponse.ok(res, 'Role permissions loaded successfully.', { permissions });
});

const updateRolePermissions = asyncHandler(async (req, res) => {
  const roleName = req.params.role;
  const permissions = req.body.permissions;
  const result = await roleService.updateRolePermissions(req.auth.schoolId, roleName, permissions);
  return ApiResponse.ok(res, 'Role permissions saved successfully.', result);
});

module.exports = {
  getRolePermissions,
  updateRolePermissions,
};
