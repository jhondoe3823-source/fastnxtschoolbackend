/**
 * Attendance controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const attendanceService = require('../../services/attendance/attendance.service');

const listStudentAttendance = asyncHandler(async (req, res) => {
  const attendance = await attendanceService.listStudentAttendance(
    req.auth.schoolId,
    req.query,
    req.auth
  );
  return ApiResponse.ok(res, 'Student attendance loaded successfully.', { attendance });
});

const getStudentRoster = asyncHandler(async (req, res) => {
  const data = await attendanceService.getStudentRoster(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Student attendance roster loaded.', data);
});

const markStudentAttendance = asyncHandler(async (req, res) => {
  const data = await attendanceService.markStudentAttendance(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.ok(res, 'Student attendance saved successfully.', data);
});

const listMyClassSections = asyncHandler(async (req, res) => {
  const sections = await attendanceService.listMyClassSections(req.auth.schoolId, req.auth);
  return ApiResponse.ok(res, 'Class sections loaded.', { sections });
});

const listMyStudentAttendance = asyncHandler(async (req, res) => {
  const attendance = await attendanceService.listMyStudentAttendance(
    req.auth.schoolId,
    req.auth,
    req.query
  );
  return ApiResponse.ok(res, 'My attendance loaded successfully.', { attendance });
});

const listStaffAttendance = asyncHandler(async (req, res) => {
  const attendance = await attendanceService.listStaffAttendance(
    req.auth.schoolId,
    req.query,
    req.auth
  );
  return ApiResponse.ok(res, 'Staff attendance loaded successfully.', { attendance });
});

const getStaffRoster = asyncHandler(async (req, res) => {
  const data = await attendanceService.getStaffRoster(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Staff attendance roster loaded.', data);
});

const markStaffAttendance = asyncHandler(async (req, res) => {
  const data = await attendanceService.markStaffAttendance(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.ok(res, 'Staff attendance saved successfully.', data);
});

module.exports = {
  listStudentAttendance,
  getStudentRoster,
  markStudentAttendance,
  listMyClassSections,
  listMyStudentAttendance,
  listStaffAttendance,
  getStaffRoster,
  markStaffAttendance,
};
