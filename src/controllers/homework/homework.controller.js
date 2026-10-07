/**
 * Homework controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const homeworkService = require('../../services/homework/homework.service');

const listHomework = asyncHandler(async (req, res) => {
  const homework = await homeworkService.listHomework(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Homework loaded successfully.', { homework });
});

const getHomework = asyncHandler(async (req, res) => {
  const homework = await homeworkService.getHomework(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Homework loaded successfully.', { homework });
});

const createHomework = asyncHandler(async (req, res) => {
  const homework = await homeworkService.createHomework(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Homework created successfully.', { homework });
});

const updateHomework = asyncHandler(async (req, res) => {
  const homework = await homeworkService.updateHomework(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Homework updated successfully.', { homework });
});

const deleteHomework = asyncHandler(async (req, res) => {
  const homework = await homeworkService.deleteHomework(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Homework deleted successfully.', homework);
});

module.exports = { listHomework, getHomework, createHomework, updateHomework, deleteHomework };
