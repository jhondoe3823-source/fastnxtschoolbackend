/**
 * Family controller — HTTP handlers for the families module.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const familyService = require('../../services/families/family.service');

const listFamilies = asyncHandler(async (req, res) => {
  const families = await familyService.listFamilies(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Families loaded successfully.', { families });
});

const getFamily = asyncHandler(async (req, res) => {
  const family = await familyService.getFamily(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Family loaded successfully.', { family });
});

const createFamily = asyncHandler(async (req, res) => {
  const family = await familyService.createFamily(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Family created successfully.', { family });
});

const updateFamily = asyncHandler(async (req, res) => {
  const family = await familyService.updateFamily(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Family updated successfully.', { family });
});

const deleteFamily = asyncHandler(async (req, res) => {
  await familyService.deleteFamily(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Family deleted successfully.', { deleted: true });
});

module.exports = {
  listFamilies,
  getFamily,
  createFamily,
  updateFamily,
  deleteFamily,
};
