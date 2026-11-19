/**
 * Platform admin routes — mounted at /api/platform.
 *
 *   POST /api/platform/auth/login
 *   GET  /api/platform/auth/me
 *   POST /api/platform/auth/logout
 *   GET  /api/platform/dashboard
 *   GET  /api/platform/schools
 *   GET  /api/platform/schools/:id
 *   PATCH /api/platform/schools/:id/status
 *   POST  /api/platform/schools/:id/extend-trial
 *   POST  /api/platform/schools/:id/set-plan
 *   PATCH /api/platform/schools/:id/admission-form
 */

const express = require('express');
const controller = require('../controllers/platform/platform.controller');
const { requirePlatformAuth } = require('../middleware/platform-auth.middleware');
const { rateLimit } = require('../middleware/rate-limit.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  key: 'platform:login',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

router.post('/auth/login', loginLimiter, controller.login);
router.get('/auth/me', requirePlatformAuth, controller.me);
router.post('/auth/logout', controller.logout);

router.get('/dashboard', requirePlatformAuth, controller.dashboard);
router.get('/schools', requirePlatformAuth, controller.listSchools);
router.get('/schools/:id', requirePlatformAuth, controller.getSchool);
router.patch('/schools/:id/status', requirePlatformAuth, controller.setSchoolActive);
router.post('/schools/:id/extend-trial', requirePlatformAuth, controller.extendTrial);
router.post('/schools/:id/set-plan', requirePlatformAuth, controller.setPlan);
router.patch('/schools/:id/admission-form', requirePlatformAuth, controller.setAdmissionForm);

module.exports = router;
