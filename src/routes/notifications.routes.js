/**
 * Notifications — mounted at /api/notifications
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const controller = require('../controllers/notifications/notification.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/unread-count', controller.unread);
router.get('/float', controller.pendingFloat);
router.post('/float/ack', controller.markFloated);
router.post('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;
