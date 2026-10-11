/**
 * Asset controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const assetService = require('../../services/assets/asset.service');

const listAssets = asyncHandler(async (req, res) => {
  const assets = await assetService.listAssets(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Assets loaded successfully.', { assets });
});

const getAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.getAsset(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Asset loaded successfully.', { asset });
});

const createAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.createAsset(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Asset created successfully.', { asset });
});

const updateAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.updateAsset(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Asset updated successfully.', { asset });
});

const deleteAsset = asyncHandler(async (req, res) => {
  await assetService.deleteAsset(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Asset deleted successfully.', { deleted: true });
});

module.exports = { listAssets, getAsset, createAsset, updateAsset, deleteAsset };
