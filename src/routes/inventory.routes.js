/**
 * Inventory routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const inventoryController = require('../controllers/inventory/inventory.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', inventoryController.listInventory);
router.post('/', inventoryController.createInventoryItem);
router.get('/:id', inventoryController.getInventoryItem);
router.patch('/:id', inventoryController.updateInventoryItem);
router.post('/:id/adjust', inventoryController.adjustStock);
router.delete('/:id', inventoryController.deleteInventoryItem);

module.exports = router;
