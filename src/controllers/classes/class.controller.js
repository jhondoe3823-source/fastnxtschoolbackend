/**
 * Class controller — HTTP handlers for school classes management.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const classService = require('../../services/classes/class.service');

const listClasses = asyncHandler(async (req, res) => {
  const classes = await classService.listClasses(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Classes loaded successfully.', { classes });
});

const getClass = asyncHandler(async (req, res) => {
  const cls = await classService.getClass(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Class loaded successfully.', { class: cls });
});

const createClass = asyncHandler(async (req, res) => {
  const cls = await classService.createClass(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Class created successfully.', { class: cls });
});

const updateClass = asyncHandler(async (req, res) => {
  const cls = await classService.updateClass(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Class updated successfully.', { class: cls });
});

const deleteClass = asyncHandler(async (req, res) => {
  await classService.deleteClass(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Class deleted successfully.', { deleted: true });
});

/** GET /api/classes/teachers — returns active employees suitable as class teachers. */
const listTeachers = asyncHandler(async (req, res) => {
  const teachers = await classService.listTeachers(req.auth.schoolId, req.query.branchId);
  return ApiResponse.ok(res, 'Teachers loaded successfully.', { teachers });
});

module.exports = {
  listClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  listTeachers,
};
