/**
 * Route aggregator — mounted once at /api in app.js.
 *
 * Each module owns a `*.routes.js` file; add new modules here so the mounting
 * order and the API surface stay in one place.
 */

const express = require('express');
const authRoutes = require('./auth.routes');
const schoolRoutes = require('./school.routes');
const branchesRoutes = require('./branches.routes');
const systemRoutes = require('./system.routes');
const usersRoutes = require('./users.routes');
const rolesRoutes = require('./roles.routes');
const complaintsRoutes = require('./complaints.routes');
const employeesRoutes = require('./employees.routes');
const jobLettersRoutes = require('./job-letters.routes');
const classesRoutes = require('./classes.routes');
const subjectsRoutes = require('./subjects.routes');
const studentsRoutes = require('./students.routes');
const familiesRoutes = require('./families.routes');

const router = express.Router();

// GET  /api/health
router.use('/', systemRoutes);

// POST /api/auth/register | /api/auth/login | /api/auth/logout
// GET  /api/auth/me
// PATCH /api/auth/me
router.use('/auth', authRoutes);

// GET   /api/school/profile   — the signed-in admin's institution
// PATCH /api/school/profile   — update its profile
router.use('/school', schoolRoutes);

// GET    /api/branches           list all branches
// POST   /api/branches           create a branch
// GET    /api/branches/:id       get a branch
// PATCH  /api/branches/:id       update a branch
// DELETE /api/branches/:id       delete a branch
// PATCH  /api/branches/:id/status update branch status
router.use('/branches', branchesRoutes);

// Users management routes
router.use('/users', usersRoutes);

// Roles & permissions management routes
router.use('/roles', rolesRoutes);

// Complaints & support tickets routes
router.use('/complaints', complaintsRoutes);
router.use('/tickets', complaintsRoutes);

// Employees directory and documents routes
router.use('/employees', employeesRoutes);

// Job letters routes
router.use('/job-letters', jobLettersRoutes);

// Classes (grade/section) management routes
router.use('/classes', classesRoutes);

// Subjects catalog and assignments routes
router.use('/subjects', subjectsRoutes);

// Students directory, admissions, and promotions routes
router.use('/students', studentsRoutes);

// Families management routes
router.use('/families', familiesRoutes);

// Admissions and Visitors routes
const admissionsRoutes = require('./admissions.routes');
const visitorsRoutes = require('./visitors.routes');
router.use('/admissions', admissionsRoutes);
router.use('/visitors', visitorsRoutes);

// Communication, Events, Meetings routes
const noticesRoutes = require('./notices.routes');
const eventsRoutes = require('./events.routes');
const meetingsRoutes = require('./meetings.routes');
const transportRoutes = require('./transport.routes');
const hostelRoutes = require('./hostel.routes');
const timetableRoutes = require('./timetable.routes');

const homeworkRoutes = require('./homework.routes');

router.use('/notices', noticesRoutes);
router.use('/events', eventsRoutes);
router.use('/meetings', meetingsRoutes);
router.use('/transport', transportRoutes);
router.use('/hostel', hostelRoutes);
router.use('/timetable', timetableRoutes);
router.use('/homework', homeworkRoutes);

module.exports = router;
