/**
 * Product modules. Used for permission/module gating later; declaring them now
 * keeps role definitions and future RBAC consistent with the frontend nav.
 */
const MODULES = {
  DASHBOARD: 'dashboard',
  CLASSES: 'classes',
  SUBJECTS: 'subjects',
  STUDENTS: 'students',
  EMPLOYEES: 'employees',
  ACCOUNTS: 'accounts',
  FEES: 'fees',
  FAMILIES: 'families',
  ADMISSIONS: 'admissions',
  ATTENDANCE: 'attendance',
  TIMETABLE: 'timetable',
  EXAMS: 'exams',
  RECRUITMENT: 'recruitment',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  LIBRARY: 'library',
  TRANSPORT: 'transport',
  HOSTEL: 'hostel',
  HEALTH: 'health',
  DISCIPLINE: 'discipline',
  INVENTORY: 'inventory',
  COMMUNICATION: 'communication',
  TASKS: 'tasks',
  COMPLAINTS: 'complaints',
  REPORTS: 'reports',
  USERS: 'users',
  SETTINGS: 'settings',
  BRANCHES: 'branches',
  AUDIT: 'audit',
  NOTIFICATIONS: 'notifications',
};

const ALL_MODULES = Object.values(MODULES);

module.exports = { MODULES, ALL_MODULES };
