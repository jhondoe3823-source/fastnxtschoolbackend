/**
 * Leave controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const leaveService = require('../../services/leave/leave.service');

const listLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.listLeave(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Leave requests loaded successfully.', { leave });
});

const listMyLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.listMyLeave(req.auth.schoolId, req.auth);
  return ApiResponse.ok(res, 'My leave requests loaded successfully.', { leave });
});

const listClassStudentLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.listClassStudentLeave(req.auth.schoolId, req.auth, req.query);
  return ApiResponse.ok(res, 'Class student leave requests loaded.', { leave });
});

const applyLeave = asyncHandler(async (req, res) => {
  const item = await leaveService.applyLeave(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Leave request submitted successfully.', { leave: item });
});

const reviewLeave = asyncHandler(async (req, res) => {
  const item = await leaveService.reviewLeave(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, `Leave request ${item.status.toLowerCase()} successfully.`, { leave: item });
});

module.exports = {
  listLeave,
  listMyLeave,
  listClassStudentLeave,
  applyLeave,
  reviewLeave,
};
