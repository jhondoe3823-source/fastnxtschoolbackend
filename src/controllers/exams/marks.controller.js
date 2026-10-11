/**
 * Exam marks / results controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const marksService = require('../../services/exams/marks.service');

const listMarkSubjects = asyncHandler(async (req, res) => {
  const subjects = await marksService.listMarkSubjects(
    req.auth.schoolId,
    req.params.id,
    req.auth
  );
  return ApiResponse.ok(res, 'Mark subjects loaded.', { subjects });
});

const getMarksRoster = asyncHandler(async (req, res) => {
  const data = await marksService.getMarksRoster(
    req.auth.schoolId,
    req.params.id,
    req.query,
    req.auth
  );
  return ApiResponse.ok(res, 'Marks roster loaded.', data);
});

const saveMarks = asyncHandler(async (req, res) => {
  const data = await marksService.saveMarks(
    req.auth.schoolId,
    req.params.id,
    req.body,
    req.auth
  );
  return ApiResponse.ok(res, 'Marks saved successfully.', data);
});

const listResults = asyncHandler(async (req, res) => {
  const results = await marksService.listResults(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Results loaded.', { results });
});

const listMyResults = asyncHandler(async (req, res) => {
  const results = await marksService.listMyResults(req.auth.schoolId, req.auth);
  return ApiResponse.ok(res, 'My results loaded.', { results });
});

const verifyExam = asyncHandler(async (req, res) => {
  const exam = await marksService.verifyExam(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Exam moved to verification.', { exam });
});

const publishResults = asyncHandler(async (req, res) => {
  const data = await marksService.publishResults(
    req.auth.schoolId,
    req.params.id,
    req.body,
    req.auth
  );
  return ApiResponse.ok(res, 'Results published successfully.', data);
});

module.exports = {
  listMarkSubjects,
  getMarksRoster,
  saveMarks,
  listResults,
  listMyResults,
  verifyExam,
  publishResults,
};
