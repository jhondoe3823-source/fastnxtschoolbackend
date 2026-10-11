/**
 * Letter templates + school email send — /api/letters
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const controller = require('../controllers/letters/letter.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/admission-template', controller.getAdmissionTemplate);
router.patch('/admission-template', controller.updateAdmissionTemplate);
router.get('/job-template', controller.getJobTemplate);
router.patch('/job-template', controller.updateJobTemplate);
router.post('/send-email', controller.sendLetterEmail);

module.exports = router;
