/**
 * Visitor controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const visitorService = require('../../services/front-office/visitor.service');

const listVisitors = asyncHandler(async (req, res) => {
  const visitors = await visitorService.listVisitors(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Visitors loaded successfully.', { visitors });
});

const getVisitor = asyncHandler(async (req, res) => {
  const visitor = await visitorService.getVisitor(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Visitor loaded successfully.', { visitor });
});

const createVisitor = asyncHandler(async (req, res) => {
  const visitor = await visitorService.createVisitor(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Visitor created successfully.', { visitor });
});

const updateVisitor = asyncHandler(async (req, res) => {
  const visitor = await visitorService.updateVisitor(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Visitor updated successfully.', { visitor });
});

const deleteVisitor = asyncHandler(async (req, res) => {
  await visitorService.deleteVisitor(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Visitor deleted successfully.', { deleted: true });
});

module.exports = { listVisitors, getVisitor, createVisitor, updateVisitor, deleteVisitor };
