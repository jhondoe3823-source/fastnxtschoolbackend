/**
 * Students routes — mounted at /api/students
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const studentController = require('../controllers/students/student.controller');

const router = express.Router();

router.use(requireAuth);

// Promote students batch
router.post('/promote', studentController.promoteStudents);

// Flattened student document registry (Certificates & Documents page)
router.get('/documents', studentController.listStudentDocuments);

// Admission letters
router.get('/admission-letters', studentController.listAdmissionLetters);
router.post('/admission-letters', studentController.generateAdmissionLetter);
router.patch('/admission-letters/:id/status', studentController.updateAdmissionLetterStatus);
router.delete('/admission-letters/:id', studentController.deleteAdmissionLetter);

// Student records CRUD
router.get('/', studentController.listStudents);
router.post('/', studentController.createStudent);
router.get('/me', studentController.getMyStudent);
router.patch('/me', studentController.updateMyStudent);
router.get('/:id', studentController.getStudent);
router.patch('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
