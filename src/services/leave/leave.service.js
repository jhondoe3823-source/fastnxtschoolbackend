/**
 * Leave request service.
 *
 * - Students and teachers can apply.
 * - Admin sees all requests and can approve/reject.
 * - Class teachers see (and can review) leave from their class students.
 * - Teacher leave is admin-only (not shown to other teachers).
 */

const { prisma } = require('../../config/database');
const { PANELS } = require('../../constants/roles');
const { badRequest, forbidden, notFound } = require('../../utils/errors');

const TYPES = new Set(['Medical', 'Casual', 'Annual', 'Sick']);
const STATUSES = new Set(['Pending', 'Approved', 'Rejected']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const trimmed = (val) => String(val ?? '').trim();

function isAdminAuth(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.ADMIN) return true;
  const role = String(auth.role || '').toLowerCase();
  return role === 'admin' || role === 'owner' || role === 'principal';
}

function isTeacherAuth(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.TEACHER) return true;
  const role = String(auth.role || '').toLowerCase();
  return role.includes('teacher') || role.includes('staff') || role.includes('employee');
}

function isStudentAuth(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.STUDENT) return true;
  return String(auth.role || '').toLowerCase().includes('student');
}

function normalizeDate(value, label = 'Date') {
  const date = trimmed(value);
  if (!DATE_RE.test(date)) throw badRequest(`${label} must be YYYY-MM-DD.`);
  return date;
}

function countDays(from, to) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw badRequest('Invalid leave dates.');
  }
  if (end < start) throw badRequest('To date cannot be before From date.');
  return Math.floor((end - start) / 86400000) + 1;
}

function serialize(row) {
  return {
    id: row.id,
    branchId: row.branchId || null,
    applicantType: row.applicantType,
    applicantId: row.applicantId,
    person: row.person,
    role: row.role,
    cls: row.cls || null,
    section: row.section || null,
    studentId: row.studentId || null,
    employeeId: row.employeeId || null,
    type: row.type,
    from: row.from,
    to: row.to,
    days: row.days,
    reason: row.reason || '',
    status: row.status,
    reviewedById: row.reviewedById || null,
    reviewedBy: row.reviewedBy || null,
    reviewNote: row.reviewNote || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveUser(schoolId, auth) {
  if (!auth?.userId) return null;
  return prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { id: true, name: true, email: true, role: true, panel: true },
  });
}

async function resolveEmployeeForUser(schoolId, auth) {
  const user = await resolveUser(schoolId, auth);
  if (!user) return null;

  const employees = await prisma.employee.findMany({
    where: { schoolId, status: 'Active' },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      designation: true,
      department: true,
      branchId: true,
    },
  });

  const emailLower = (user.email || '').toLowerCase();
  const nameLower = (user.name || '').toLowerCase();

  return (
    employees.find((e) => (e.email || '').toLowerCase() === emailLower) ||
    employees.find((e) => (e.name || '').toLowerCase() === nameLower) ||
    null
  );
}

async function resolveStudentForUser(schoolId, auth) {
  const user = await resolveUser(schoolId, auth);
  if (!user) return null;

  return (
    (await prisma.student.findFirst({
      where: { schoolId, email: { equals: user.email, mode: 'insensitive' } },
    })) ||
    (await prisma.student.findFirst({
      where: { schoolId, name: { equals: user.name, mode: 'insensitive' } },
    }))
  );
}

async function listClassTeacherPairs(schoolId, employee) {
  if (!employee) return [];

  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      status: 'Active',
      OR: [
        { teacherId: employee.id },
        { teacher: { equals: employee.name, mode: 'insensitive' } },
      ],
    },
    select: { name: true, sections: true },
  });

  const pairs = [];
  for (const c of classes) {
    const sections = Array.isArray(c.sections) ? c.sections : ['A'];
    for (const section of sections) {
      pairs.push({ cls: c.name, section });
    }
  }
  return pairs;
}

async function isClassTeacherOf(schoolId, auth, cls, section) {
  if (isAdminAuth(auth)) return true;
  const employee = await resolveEmployeeForUser(schoolId, auth);
  if (!employee) return false;
  const pairs = await listClassTeacherPairs(schoolId, employee);
  return pairs.some(
    (p) =>
      p.cls.toLowerCase() === String(cls || '').toLowerCase() &&
      p.section.toLowerCase() === String(section || '').toLowerCase()
  );
}

async function applyLeave(schoolId, input, auth) {
  const type = trimmed(input.type) || 'Casual';
  if (!TYPES.has(type)) throw badRequest('Leave type must be Medical, Casual, Annual, or Sick.');

  const from = normalizeDate(input.from, 'From date');
  const to = normalizeDate(input.to, 'To date');
  const days = countDays(from, to);
  const reason = trimmed(input.reason);
  if (!reason) throw badRequest('Reason is required.');

  let applicantType;
  let applicantId;
  let person;
  let role;
  let cls = null;
  let section = null;
  let studentId = null;
  let employeeId = null;
  let branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  if (isStudentAuth(auth)) {
    const student = await resolveStudentForUser(schoolId, auth);
    if (!student) throw badRequest('No student profile is linked to your account.');

    applicantType = 'Student';
    applicantId = student.id;
    studentId = student.id;
    person = student.name;
    cls = student.cls;
    section = student.section;
    role = `Student (${student.cls}-${student.section})`;
    branchId = branchId || student.branchId || null;
  } else if (isTeacherAuth(auth) || isAdminAuth(auth)) {
    // Teachers apply as staff leave. Admins can also apply if they have an employee row.
    const employee = await resolveEmployeeForUser(schoolId, auth);
    if (!employee) {
      throw badRequest('No employee profile is linked to your account.');
    }

    applicantType = 'Teacher';
    applicantId = employee.id;
    employeeId = employee.id;
    person = employee.name;
    role = employee.designation || 'Teacher';
    branchId = branchId || employee.branchId || null;
  } else {
    throw forbidden('Only students and teachers can apply for leave.');
  }

  const row = await prisma.leaveRequest.create({
    data: {
      schoolId,
      branchId,
      applicantType,
      applicantId,
      person,
      role,
      cls,
      section,
      studentId,
      employeeId,
      type,
      from,
      to,
      days,
      reason,
      status: 'Pending',
    },
  });

  return serialize(row);
}

async function listLeave(schoolId, query = {}, auth) {
  const where = { schoolId };

  if (query.branchId && query.branchId !== 'all') where.branchId = query.branchId;
  if (query.status) {
    const status = trimmed(query.status);
    if (!STATUSES.has(status)) throw badRequest('Invalid status.');
    where.status = status;
  }
  if (query.applicantType) {
    const type = trimmed(query.applicantType);
    if (type !== 'Student' && type !== 'Teacher') throw badRequest('Invalid applicant type.');
    where.applicantType = type;
  }

  // Visibility rules
  if (isAdminAuth(auth)) {
    // all
  } else if (isTeacherAuth(auth)) {
    const employee = await resolveEmployeeForUser(schoolId, auth);
    const pairs = await listClassTeacherPairs(schoolId, employee);
    const or = [];

    // Own teacher leave
    if (employee) {
      or.push({ employeeId: employee.id, applicantType: 'Teacher' });
    }

    // Class students' leave
    for (const p of pairs) {
      or.push({
        applicantType: 'Student',
        cls: p.cls,
        section: p.section,
      });
    }

    if (or.length === 0) return [];
    where.OR = or;
  } else if (isStudentAuth(auth)) {
    const student = await resolveStudentForUser(schoolId, auth);
    if (!student) return [];
    where.studentId = student.id;
    where.applicantType = 'Student';
  } else {
    throw forbidden('You do not have access to leave requests.');
  }

  const rows = await prisma.leaveRequest.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });

  return rows.map(serialize);
}

async function listMyLeave(schoolId, auth) {
  if (isStudentAuth(auth)) {
    const student = await resolveStudentForUser(schoolId, auth);
    if (!student) return [];
    const rows = await prisma.leaveRequest.findMany({
      where: { schoolId, studentId: student.id, applicantType: 'Student' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serialize);
  }

  if (isTeacherAuth(auth) || isAdminAuth(auth)) {
    const employee = await resolveEmployeeForUser(schoolId, auth);
    if (!employee) return [];
    const rows = await prisma.leaveRequest.findMany({
      where: { schoolId, employeeId: employee.id, applicantType: 'Teacher' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serialize);
  }

  return [];
}

async function listClassStudentLeave(schoolId, auth, query = {}) {
  if (isAdminAuth(auth)) {
    return listLeave(schoolId, { ...query, applicantType: 'Student' }, auth);
  }

  if (!isTeacherAuth(auth)) {
    throw forbidden('Only class teachers can view student leave requests.');
  }

  const employee = await resolveEmployeeForUser(schoolId, auth);
  const pairs = await listClassTeacherPairs(schoolId, employee);
  if (pairs.length === 0) return [];

  const where = {
    schoolId,
    applicantType: 'Student',
    OR: pairs.map((p) => ({ cls: p.cls, section: p.section })),
  };

  if (query.branchId && query.branchId !== 'all') where.branchId = query.branchId;
  if (query.status) {
    const status = trimmed(query.status);
    if (!STATUSES.has(status)) throw badRequest('Invalid status.');
    where.status = status;
  }

  const rows = await prisma.leaveRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(serialize);
}

async function reviewLeave(schoolId, id, input, auth) {
  const status = trimmed(input.status);
  if (!STATUSES.has(status) || status === 'Pending') {
    throw badRequest('Status must be Approved or Rejected.');
  }

  const existing = await prisma.leaveRequest.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Leave request not found.');

  if (isAdminAuth(auth)) {
    // ok
  } else if (isTeacherAuth(auth) && existing.applicantType === 'Student') {
    const allowed = await isClassTeacherOf(schoolId, auth, existing.cls, existing.section);
    if (!allowed) {
      throw forbidden('You can only review leave for students in your class.');
    }
  } else {
    throw forbidden('You cannot review this leave request.');
  }

  const user = await resolveUser(schoolId, auth);

  const updated = await prisma.leaveRequest.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedById: auth.userId || null,
      reviewedBy: user?.name || null,
      reviewNote: trimmed(input.reviewNote) || null,
    },
  });

  return serialize(updated);
}

module.exports = {
  applyLeave,
  listLeave,
  listMyLeave,
  listClassStudentLeave,
  reviewLeave,
  TYPES: [...TYPES],
  STATUSES: [...STATUSES],
};
