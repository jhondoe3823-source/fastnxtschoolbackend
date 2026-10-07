/**
 * Roles routes — mounted at /api/roles
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const roleController = require('../controllers/roles/role.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/permissions', roleController.getRolePermissions);
router.get('/:role/permissions', roleController.getRolePermissions);
router.put('/:role/permissions', roleController.updateRolePermissions);

module.exports = router;
