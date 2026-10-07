/**
 * Visitors routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const visitorController = require('../controllers/front-office/visitor.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', visitorController.listVisitors);
router.post('/', visitorController.createVisitor);
router.get('/:id', visitorController.getVisitor);
router.patch('/:id', visitorController.updateVisitor);
router.delete('/:id', visitorController.deleteVisitor);

module.exports = router;
