/**
 * Leave request routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const leaveController = require('../controllers/leave/leave.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', leaveController.listLeave);
router.get('/me', leaveController.listMyLeave);
router.get('/class-students', leaveController.listClassStudentLeave);
router.post('/', leaveController.applyLeave);
router.patch('/:id/status', leaveController.reviewLeave);

module.exports = router;
