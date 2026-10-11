/**
 * Attendance routes — student + staff day-wise registers.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const attendanceController = require('../controllers/attendance/attendance.controller');

const router = express.Router();

router.use(requireAuth);

// Teacher / admin helpers
router.get('/my-sections', attendanceController.listMyClassSections);
router.get('/me', attendanceController.listMyStudentAttendance);

// Student attendance
router.get('/students', attendanceController.listStudentAttendance);
router.get('/students/roster', attendanceController.getStudentRoster);
router.post('/students/mark', attendanceController.markStudentAttendance);

// Staff attendance
router.get('/staff', attendanceController.listStaffAttendance);
router.get('/staff/roster', attendanceController.getStaffRoster);
router.post('/staff/mark', attendanceController.markStaffAttendance);

module.exports = router;
