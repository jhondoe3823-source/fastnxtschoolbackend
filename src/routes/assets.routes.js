/**
 * Assets routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const assetController = require('../controllers/assets/asset.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', assetController.listAssets);
router.post('/', assetController.createAsset);
router.get('/:id', assetController.getAsset);
router.patch('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
