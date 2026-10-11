/**
 * Mail routes — mounted at /api/mail
 *
 *   GET /api/mail/usage  — per-school outbound email totals (auth)
 *
 * Intentionally not used by the frontend yet.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const controller = require('../controllers/mail/mail.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/usage', controller.usage);

module.exports = router;

// Note: school-branded send is at POST /api/letters/send-email

