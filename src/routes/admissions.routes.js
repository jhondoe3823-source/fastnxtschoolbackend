/**
 * Admissions routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const admissionController = require('../controllers/admissions/admission.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', admissionController.listEnquiries);
router.post('/', admissionController.createEnquiry);
router.get('/:id', admissionController.getEnquiry);
router.patch('/:id', admissionController.updateEnquiry);
router.delete('/:id', admissionController.deleteEnquiry);

module.exports = router;
