/**
 * Account roles. Kept as plain strings (not a Prisma enum) so new roles can be
 * added without a database migration — the User.role column is a free string.
 */
const ROLES = {
  /** School owner / first registrant — full access (matches frontend ROLE_DEFS). */
  ADMIN: 'Super Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
  ACCOUNTANT: 'Accountant',
};

/** Panels a user can land on after signing in (mirrors the frontend panels). */
const PANELS = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
};

module.exports = {
  ROLES,
  PANELS,
  DEFAULT_ROLE: ROLES.ADMIN,
  DEFAULT_PANEL: PANELS.ADMIN,
};
