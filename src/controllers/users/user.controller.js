/**
 * User controller — handle HTTP requests for user account management.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const userService = require('../../services/users/user.service');

const listUsers = asyncHandler(async (req, res) => {
  const users = await userService.listUsers(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Users loaded successfully.', { users });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'User loaded successfully.', { user });
});

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'User account created successfully.', { user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'User updated successfully.', { user });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await userService.resetPassword(req.auth.schoolId, req.params.id, req.body.password);
  return ApiResponse.ok(res, 'Password reset initiated.', result);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const user = await userService.toggleStatus(req.auth.schoolId, req.params.id, req.body.status);
  return ApiResponse.ok(res, 'User status updated successfully.', { user });
});

const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.auth.schoolId, req.auth.userId, req.params.id);
  return ApiResponse.ok(res, 'User deleted successfully.', { deleted: true });
});

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  resetPassword,
  toggleStatus,
  deleteUser,
};
