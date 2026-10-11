/**
 * Student controller — HTTP handlers for students, promotions, and admission letters.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const studentService = require('../../services/students/student.service');

const listStudents = asyncHandler(async (req, res) => {
  const students = await studentService.listStudents(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Students loaded successfully.', { students });
});

const getMyStudent = asyncHandler(async (req, res) => {
  const student = await studentService.getMyStudent(req.auth.schoolId, req.auth);
  return ApiResponse.ok(res, 'Student profile loaded successfully.', { student });
});

const updateMyStudent = asyncHandler(async (req, res) => {
  const student = await studentService.updateMyStudent(req.auth.schoolId, req.auth, req.body);
  return ApiResponse.ok(res, 'Student profile updated successfully.', { student });
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await studentService.getStudent(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Student loaded successfully.', { student });
});

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentService.createStudent(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Student created successfully.', { student });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentService.updateStudent(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Student updated successfully.', { student });
});

const deleteStudent = asyncHandler(async (req, res) => {
  await studentService.deleteStudent(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Student deleted successfully.', { deleted: true });
});

const promoteStudents = asyncHandler(async (req, res) => {
  const result = await studentService.promoteStudents(req.auth.schoolId, req.body);
  return ApiResponse.ok(res, 'Students promoted successfully.', result);
});

const listStudentDocuments = asyncHandler(async (req, res) => {
  const documents = await studentService.listStudentDocuments(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Student documents loaded successfully.', { documents });
});

const listAdmissionLetters = asyncHandler(async (req, res) => {
  const letters = await studentService.listAdmissionLetters(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Admission letters loaded successfully.', { letters });
});

const generateAdmissionLetter = asyncHandler(async (req, res) => {
  const letter = await studentService.generateAdmissionLetter(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Admission letter generated successfully.', { letter });
});

const updateAdmissionLetterStatus = asyncHandler(async (req, res) => {
  const letter = await studentService.updateAdmissionLetterStatus(req.auth.schoolId, req.params.id, req.body.status);
  return ApiResponse.ok(res, 'Admission letter status updated successfully.', { letter });
});

const deleteAdmissionLetter = asyncHandler(async (req, res) => {
  await studentService.deleteAdmissionLetter(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Admission letter deleted successfully.', { deleted: true });
});

module.exports = {
  listStudents,
  getMyStudent,
  updateMyStudent,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  promoteStudents,
  listStudentDocuments,
  listAdmissionLetters,
  generateAdmissionLetter,
  updateAdmissionLetterStatus,
  deleteAdmissionLetter,
};
