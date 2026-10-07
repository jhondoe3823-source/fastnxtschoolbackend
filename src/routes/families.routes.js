/**
 * Families routes — mounted at /api/families
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const familyController = require('../controllers/families/family.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', familyController.listFamilies);
router.post('/', familyController.createFamily);
router.get('/:id', familyController.getFamily);
router.patch('/:id', familyController.updateFamily);
router.delete('/:id', familyController.deleteFamily);

module.exports = router;
