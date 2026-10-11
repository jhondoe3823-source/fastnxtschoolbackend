/**
 * Upload routes — mounted at /api/uploads.
 *
 *   GET  /api/uploads/status
 *   GET  /api/uploads/usage     per-school storage totals (auth)
 *   GET  /api/uploads/download  signed file download (auth)
 *   POST /api/uploads           multipart/form-data field: file
 */

const express = require('express');
const controller = require('../controllers/uploads/upload.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { singleFile, handleMulterError } = require('../middleware/upload.middleware');

const router = express.Router();

router.get('/status', controller.status);

router.use(requireAuth);

router.get('/usage', controller.usage);
router.get('/download', controller.download);

router.post('/', (req, res, next) => {
  singleFile(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    return controller.uploadFile(req, res, next);
  });
});

module.exports = router;
