/**
 * Notices routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const noticeController = require('../controllers/communication/notice.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', noticeController.listNotices);
router.post('/', noticeController.createNotice);
router.get('/:id', noticeController.getNotice);
router.patch('/:id', noticeController.updateNotice);
router.delete('/:id', noticeController.deleteNotice);

module.exports = router;
