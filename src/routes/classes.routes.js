/**
 * Classes routes — mounted at /api/classes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const classController = require('../controllers/classes/class.controller');

const router = express.Router();

router.use(requireAuth);

// GET /api/classes/teachers — must be before /:id to avoid conflicts
router.get('/teachers', classController.listTeachers);

router.get('/', classController.listClasses);
router.post('/', classController.createClass);
router.get('/:id', classController.getClass);
router.patch('/:id', classController.updateClass);
router.delete('/:id', classController.deleteClass);

module.exports = router;
