const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const courseService = require('../../services/courses/course.service');

const listCourses = asyncHandler(async (req, res) => {
  const courses = await courseService.listCourses(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Courses loaded successfully.', { courses });
});

const createCourse = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Course saved.', { course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Course updated.', { course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  await courseService.deleteCourse(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Course deleted.', { deleted: true });
});

module.exports = {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
};
