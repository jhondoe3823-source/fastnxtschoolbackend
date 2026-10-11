/**
 * School rules & regulations routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const ruleController = require('../controllers/rules/rule.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', ruleController.listRules);
router.post('/', ruleController.createRule);
router.get('/:id', ruleController.getRule);
router.patch('/:id', ruleController.updateRule);
router.delete('/:id', ruleController.deleteRule);

module.exports = router;
