/**
 * Subjects routes — mounted at /api/subjects
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const subjectController = require('../controllers/subjects/subject.controller');

const router = express.Router();

router.use(requireAuth);

// Classes with assigned subjects overview
router.get('/classes', subjectController.listClassesWithSubjects);

// Subject assignments
router.get('/assignments', subjectController.listAssignments);
router.post('/assignments', subjectController.createAssignment);
router.delete('/assignments/:id', subjectController.deleteAssignment);

// Subjects catalog
router.get('/', subjectController.listSubjects);
router.post('/', subjectController.createSubject);
router.get('/:id', subjectController.getSubject);
router.patch('/:id', subjectController.updateSubject);
router.delete('/:id', subjectController.deleteSubject);

module.exports = router;
