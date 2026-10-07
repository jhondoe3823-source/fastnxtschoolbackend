/**
 * Job letters routes — mounted at /api/job-letters
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const jobLetterController = require('../controllers/job-letters/job-letter.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', jobLetterController.listJobLetters);
router.post('/', jobLetterController.createJobLetter);
router.get('/:id', jobLetterController.getJobLetter);
router.patch('/:id/status', jobLetterController.updateJobLetterStatus);
router.delete('/:id', jobLetterController.deleteJobLetter);

module.exports = router;
