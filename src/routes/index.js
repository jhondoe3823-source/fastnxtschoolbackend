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
const coursesRoutes = require('./courses.routes');
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
// POST  /api/school/logo      — upload institute logo to Cloudinary
router.use('/school', schoolRoutes);

// GET  /api/uploads/status
// POST /api/uploads           — generic authenticated Cloudinary upload
const uploadsRoutes = require('./uploads.routes');
router.use('/uploads', uploadsRoutes);

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

// GET    /api/courses
// POST   /api/courses
// PATCH  /api/courses/:id
// DELETE /api/courses/:id
router.use('/courses', coursesRoutes);

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
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leave.routes');
const feesRoutes = require('./fees.routes');
const examsRoutes = require('./exams.routes');
const rulesRoutes = require('./rules.routes');
const payrollRoutes = require('./payroll.routes');
const accountsRoutes = require('./accounts.routes');
const dashboardRoutes = require('./dashboard.routes');

router.use('/dashboard', dashboardRoutes);
router.use('/notices', noticesRoutes);
router.use('/events', eventsRoutes);
router.use('/meetings', meetingsRoutes);
router.use('/transport', transportRoutes);
router.use('/hostel', hostelRoutes);
router.use('/timetable', timetableRoutes);
router.use('/homework', homeworkRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave', leaveRoutes);
router.use('/fees', feesRoutes);
router.use('/exams', examsRoutes);
router.use('/rules', rulesRoutes);
router.use('/payroll', payrollRoutes);
router.use('/accounts', accountsRoutes);

// Assets & Inventory
const assetsRoutes = require('./assets.routes');
const inventoryRoutes = require('./inventory.routes');
router.use('/assets', assetsRoutes);
router.use('/inventory', inventoryRoutes);

// In-app notifications
const notificationsRoutes = require('./notifications.routes');
router.use('/notifications', notificationsRoutes);

// Mail usage (Resend ledger) — API ready, UI not wired yet
const mailRoutes = require('./mail.routes');
router.use('/mail', mailRoutes);

// Letter templates (admission / job) + school-branded send-email
const lettersRoutes = require('./letters.routes');
router.use('/letters', lettersRoutes);

// Platform admin console (FastNxt Admin)
// POST /api/platform/auth/login | GET /me | POST /logout
// GET  /api/platform/dashboard | /schools | /schools/:id
const platformRoutes = require('./platform.routes');
router.use('/platform', platformRoutes);

module.exports = router;
