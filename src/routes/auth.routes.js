/**
 * Auth routes — mounted at /api/auth.
 *
 *   POST /api/auth/register   create school + admin + 5-day trial
 *   POST /api/auth/login      sign in
 *   GET  /api/auth/me         current session (also used to restore on refresh)
 *   PATCH /api/auth/me        update current user profile
 *   POST /api/auth/logout     clear the session cookie
 */

const express = require('express');
const controller = require('../controllers/auth/auth.controller');
const { validateRegister, validateLogin, validateUpdateProfile } = require('../validators/auth/auth.validator');
const { requireAuth } = require('../middleware/auth.middleware');
const { rateLimit } = require('../middleware/rate-limit.middleware');

const router = express.Router();

// Throttle credential endpoints: 10 registrations/hour and 15 logins/15min/IP.
const registerLimiter = rateLimit({
  key: 'auth:register',
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many schools registered from this network. Please try again later.',
});

const loginLimiter = rateLimit({
  key: 'auth:login',
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

router.post('/register', registerLimiter, validateRegister, controller.register);
router.post('/login', loginLimiter, validateLogin, controller.login);
router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validateUpdateProfile, controller.updateProfile);
router.post('/logout', controller.logout);

module.exports = router;
