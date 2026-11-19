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
const { singleImage, handleMulterError } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/profile', controller.getProfile);
router.patch('/profile', validateUpdateProfile, controller.updateProfile);
router.get('/admission-form-config', controller.getAdmissionFormConfig);
router.patch('/admission-form-config', controller.updateAdmissionFormConfig);
router.post('/logo', (req, res, next) => {
  singleImage(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    return controller.uploadLogo(req, res, next);
  });
});

module.exports = router;
