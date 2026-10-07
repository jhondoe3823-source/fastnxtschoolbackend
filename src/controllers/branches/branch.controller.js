/**
 * Branch controller — thin HTTP layer over the branch service.
 *
 * Every handler reads the school from the session (`req.auth.schoolId`), so an
 * admin can only ever read and write branches belonging to their own school.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const branchService = require('../../services/branches/branch.service');

/** GET /api/branches — list all branches for the current school. */
const listBranches = asyncHandler(async (req, res) => {
  const branches = await branchService.listBranches(req.auth.schoolId);
  return ApiResponse.ok(res, 'Branches loaded successfully.', { branches });
});

/** POST /api/branches — create a new branch. */
const createBranch = asyncHandler(async (req, res) => {
  const branch = await branchService.createBranch(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Branch created successfully.', { branch });
});

/** GET /api/branches/:id — get a single branch. */
const getBranch = asyncHandler(async (req, res) => {
  const branch = await branchService.getBranch(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Branch loaded successfully.', { branch });
});

/** PATCH /api/branches/:id — update a branch (partial). */
const updateBranch = asyncHandler(async (req, res) => {
  const branch = await branchService.updateBranch(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Branch updated successfully.', { branch });
});

/** DELETE /api/branches/:id — delete a branch. */
const deleteBranch = asyncHandler(async (req, res) => {
  await branchService.deleteBranch(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Branch deleted successfully.', { deleted: true });
});

/** PATCH /api/branches/:id/status — activate/deactivate a branch. */
const updateBranchStatus = asyncHandler(async (req, res) => {
  const branch = await branchService.updateBranchStatus(req.auth.schoolId, req.params.id, req.body.status);
  return ApiResponse.ok(res, 'Branch status updated successfully.', { branch });
});

module.exports = {
  listBranches,
  createBranch,
  getBranch,
  updateBranch,
  deleteBranch,
  updateBranchStatus,
};
