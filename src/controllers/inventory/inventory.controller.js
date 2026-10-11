/**
 * Inventory controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const inventoryService = require('../../services/inventory/inventory.service');

const listInventory = asyncHandler(async (req, res) => {
  const items = await inventoryService.listInventory(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Inventory loaded successfully.', { items });
});

const getInventoryItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.getInventoryItem(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Inventory item loaded successfully.', { item });
});

const createInventoryItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.createInventoryItem(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Inventory item created successfully.', { item });
});

const updateInventoryItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.updateInventoryItem(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Inventory item updated successfully.', { item });
});

const adjustStock = asyncHandler(async (req, res) => {
  const item = await inventoryService.adjustStock(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, 'Stock adjusted successfully.', { item });
});

const deleteInventoryItem = asyncHandler(async (req, res) => {
  await inventoryService.deleteInventoryItem(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Inventory item deleted successfully.', { deleted: true });
});

module.exports = {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
};
