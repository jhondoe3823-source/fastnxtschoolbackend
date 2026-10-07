/**
 * School routes — mounted at /api/school.
 *
 *   GET   /api/school/profile   the signed-in admin's school profile
 *   PATCH /api/school/profile   update it (partial body)
 *
 * Both routes require a session: the school is taken from the token, so there is
 * no id in the path for a client to tamper with.
 */

const express = require('express');
const controller = require('../controllers/school/school.controller');
const { validateUpdateProfile } = require('../validators/school/school.validator');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/profile', controller.getProfile);
router.patch('/profile', validateUpdateProfile, controller.updateProfile);

module.exports = router;
