const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const courseController = require('../controllers/courses/course.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', courseController.listCourses);
router.post('/', courseController.createCourse);
router.patch('/:id', courseController.updateCourse);
router.delete('/:id', courseController.deleteCourse);

module.exports = router;
