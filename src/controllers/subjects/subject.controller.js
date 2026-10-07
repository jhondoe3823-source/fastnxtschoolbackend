/**
 * Subject controller — HTTP handlers for subjects and assignments management.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const subjectService = require('../../services/subjects/subject.service');

const listSubjects = asyncHandler(async (req, res) => {
  const subjects = await subjectService.listSubjects(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Subjects loaded successfully.', { subjects });
});

const getSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.getSubject(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Subject loaded successfully.', { subject });
});

const createSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.createSubject(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Subject created successfully.', { subject });
});

const updateSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.updateSubject(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Subject updated successfully.', { subject });
});

const deleteSubject = asyncHandler(async (req, res) => {
  await subjectService.deleteSubject(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Subject deleted successfully.', { deleted: true });
});

const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await subjectService.listAssignments(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Subject assignments loaded successfully.', { assignments });
});

const createAssignment = asyncHandler(async (req, res) => {
  const assignment = await subjectService.createAssignment(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Subject assigned successfully.', { assignment });
});

const deleteAssignment = asyncHandler(async (req, res) => {
  await subjectService.deleteAssignment(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Subject assignment removed successfully.', { deleted: true });
});

const listClassesWithSubjects = asyncHandler(async (req, res) => {
  const classes = await subjectService.listClassesWithSubjects(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Classes with subjects loaded successfully.', { classes });
});

module.exports = {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  listAssignments,
  createAssignment,
  deleteAssignment,
  listClassesWithSubjects,
};
