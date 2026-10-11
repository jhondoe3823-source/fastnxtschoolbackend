/**
 * Exam controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const examService = require('../../services/exams/exam.service');

const listExams = asyncHandler(async (req, res) => {
  const exams = await examService.listExams(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Exams loaded successfully.', { exams });
});

const getExam = asyncHandler(async (req, res) => {
  const data = await examService.getExam(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Exam loaded successfully.', data);
});

const createExam = asyncHandler(async (req, res) => {
  const exam = await examService.createExam(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Exam created successfully.', { exam });
});

const updateExam = asyncHandler(async (req, res) => {
  const exam = await examService.updateExam(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, 'Exam updated successfully.', { exam });
});

const notifyExam = asyncHandler(async (req, res) => {
  const exam = await examService.notifyExam(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, 'Exam notice sent to teachers and students.', { exam });
});

const deleteExam = asyncHandler(async (req, res) => {
  const result = await examService.deleteExam(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Exam deleted successfully.', result);
});

const listSlots = asyncHandler(async (req, res) => {
  const slots = await examService.listSlots(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Exam timetable loaded successfully.', { slots });
});

const createSlot = asyncHandler(async (req, res) => {
  const slot = await examService.createSlot(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Paper slot added successfully.', { slot });
});

const updateSlot = asyncHandler(async (req, res) => {
  const slot = await examService.updateSlot(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, 'Paper slot updated successfully.', { slot });
});

const deleteSlot = asyncHandler(async (req, res) => {
  const result = await examService.deleteSlot(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Paper slot deleted successfully.', result);
});

const listSubmissions = asyncHandler(async (req, res) => {
  const submissions = await examService.listSubmissions(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Question paper submissions loaded.', { submissions });
});

const reviewSubmission = asyncHandler(async (req, res) => {
  const submission = await examService.reviewSubmission(
    req.auth.schoolId,
    req.params.id,
    req.body,
    req.auth
  );
  return ApiResponse.ok(res, `Question paper ${submission.status.toLowerCase()}.`, { submission });
});

const listMyPaperTasks = asyncHandler(async (req, res) => {
  const data = await examService.listMyPaperTasks(req.auth.schoolId, req.auth);
  return ApiResponse.ok(res, 'Paper tasks loaded successfully.', data);
});

const submitQuestionPaper = asyncHandler(async (req, res) => {
  const submission = await examService.submitQuestionPaper(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Question paper submitted successfully.', { submission });
});

module.exports = {
  listExams,
  getExam,
  createExam,
  updateExam,
  notifyExam,
  deleteExam,
  listSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  listSubmissions,
  reviewSubmission,
  listMyPaperTasks,
  submitQuestionPaper,
};
