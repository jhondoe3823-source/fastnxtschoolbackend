/**
 * Exam routes — sessions, paper timetable, question paper submissions, marks/results.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const examController = require('../controllers/exams/exam.controller');
const marksController = require('../controllers/exams/marks.controller');

const router = express.Router();

router.use(requireAuth);

// Teacher paper duties + submit (before :id routes)
router.get('/my-papers', examController.listMyPaperTasks);
router.post('/papers', examController.submitQuestionPaper);

// Results (before :id)
router.get('/results/me', marksController.listMyResults);
router.get('/results', marksController.listResults);

// Submissions (admin)
router.get('/submissions', examController.listSubmissions);
router.patch('/submissions/:id', examController.reviewSubmission);

// Paper timetable slots
router.get('/slots', examController.listSlots);
router.post('/slots', examController.createSlot);
router.patch('/slots/:id', examController.updateSlot);
router.delete('/slots/:id', examController.deleteSlot);

// Exam sessions
router.get('/', examController.listExams);
router.post('/', examController.createExam);
router.get('/:id', examController.getExam);
router.patch('/:id', examController.updateExam);
router.post('/:id/notify', examController.notifyExam);
router.get('/:id/mark-subjects', marksController.listMarkSubjects);
router.get('/:id/marks/roster', marksController.getMarksRoster);
router.post('/:id/marks', marksController.saveMarks);
router.post('/:id/verify', marksController.verifyExam);
router.post('/:id/publish', marksController.publishResults);
router.delete('/:id', examController.deleteExam);

module.exports = router;
