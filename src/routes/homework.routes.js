/**
 * Homework routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const homeworkController = require('../controllers/homework/homework.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', homeworkController.listHomework);
router.post('/', homeworkController.createHomework);
router.get('/:id', homeworkController.getHomework);
router.patch('/:id', homeworkController.updateHomework);
router.delete('/:id', homeworkController.deleteHomework);

module.exports = router;
