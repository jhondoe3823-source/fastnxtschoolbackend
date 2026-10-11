/**
 * Attendance service — day-wise student + staff registers.
 *
 * Student attendance is marked by class teachers (or admins).
 * Staff attendance is marked by admins.
 */

const { prisma } = require('../../config/database');
const { PANELS } = require('../../constants/roles');
const { badRequest, forbidden, notFound } = require('../../utils/errors');

const STATUSES = new Set(['Present', 'Absent', 'Late', 'Leave']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const trimmed = (val) => String(val ?? '').trim();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value) {
  const date = trimmed(value) || todayIso();
  if (!DATE_RE.test(date)) throw badRequest('Date must be YYYY-MM-DD.');
  return date;
}

function normalizeStatus(value) {
  const status = trimmed(value);
  if (!STATUSES.has(status)) {
    throw badRequest('Status must be Present, Absent, Late, or Leave.');
  }
  return status;
}

function isAdminAuth(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.ADMIN) return true;
  const role = String(auth.role || '').toLowerCase();
  return (
    role.includes('admin') ||
    role.includes('principal') ||
    role.includes('owner') ||
    role.includes('coordinator') ||
    role.includes('hr')
  );
}

/** Staff attendance: admin-panel / office roles only — never teacher or student. */
function canMarkStaffAttendance(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.TEACHER || auth.panel === PANELS.STUDENT) return false;
  return isAdminAuth(auth);
}

function isTeacherPanel(auth) {
  return auth?.panel === PANELS.TEACHER || String(auth?.role || '').toLowerCase().includes('teacher');
}

function serializeStudent(row) {
  return {
    id: row.id,
    branchId: row.branchId || null,
    studentId: row.studentId,
    student: row.studentName,
    studentCode: row.studentCode || null,
    cls: row.cls,
    section: row.section,
    date: row.date,
    status: row.status,
    remark: row.remark || '',
    markedById: row.markedById || null,
    markedBy: row.markedBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeStaff(row) {
  return {
    id: row.id,
    branchId: row.branchId || null,
    employeeId: row.employeeId,
    employee: row.employeeName,
    employeeCode: row.employeeCode || null,
    designation: row.designation || '',
    department: row.department || '',
    date: row.date,
    status: row.status,
    inTime: row.inTime || '—',
    outTime: row.outTime || '—',
    remark: row.remark || '',
    markedById: row.markedById || null,
    markedBy: row.markedBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveEmployeeForUser(schoolId, auth) {
  if (!auth?.userId) return null;

  const user = await prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { id: true, name: true, email: true },
  });
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

async function assertCanMarkClass(schoolId, auth, clsName) {
  if (isAdminAuth(auth)) return;

  const employee = await resolveEmployeeForUser(schoolId, auth);
  if (!employee) {
    throw forbidden('Only class teachers can mark attendance for their classes.');
  }

  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      name: clsName,
      status: 'Active',
    },
    select: { id: true, name: true, teacher: true, teacherId: true, sections: true },
  });

  const allowed = classes.some(
    (c) =>
      c.teacherId === employee.id ||
      (c.teacher || '').toLowerCase() === (employee.name || '').toLowerCase()
  );

  if (!allowed) {
    throw forbidden('You can only mark attendance for classes where you are the class teacher.');
  }
}

async function listStudentAttendance(schoolId, query = {}, auth = null) {
  if (auth?.panel === PANELS.STUDENT) {
    throw forbidden('Students can only view their own attendance via /attendance/me.');
  }

  const where = { schoolId };

  if (query.branchId && query.branchId !== 'all') where.branchId = query.branchId;
  if (query.cls) where.cls = trimmed(query.cls);
  if (query.section) where.section = trimmed(query.section);
  if (query.studentId) where.studentId = trimmed(query.studentId);
  if (query.status) where.status = normalizeStatus(query.status);

  if (query.date) {
    where.date = normalizeDate(query.date);
  } else if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = normalizeDate(query.from);
    if (query.to) where.date.lte = normalizeDate(query.to);
  }

  // Teachers only see classes they teach as class teacher.
  if (auth && isTeacherPanel(auth) && !isAdminAuth(auth)) {
    const sections = await listMyClassSections(schoolId, auth);
    if (!sections.length) return [];
    where.OR = sections.map((s) => ({ cls: s.cls, section: s.section }));
  }

  const rows = await prisma.studentAttendance.findMany({
    where,
    orderBy: [{ date: 'desc' }, { cls: 'asc' }, { section: 'asc' }, { studentName: 'asc' }],
  });

  return rows.map(serializeStudent);
}

async function getStudentRoster(schoolId, query = {}, auth) {
  const date = normalizeDate(query.date);
  const cls = trimmed(query.cls);
  const section = trimmed(query.section);

  if (!cls) throw badRequest('Class is required.');
  if (!section) throw badRequest('Section is required.');

  await assertCanMarkClass(schoolId, auth, cls);

  const studentWhere = {
    schoolId,
    cls,
    section,
    status: 'Active',
  };
  if (query.branchId && query.branchId !== 'all') {
    studentWhere.OR = [{ branchId: query.branchId }, { branchId: null }];
  }

  const [students, existing] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      orderBy: { name: 'asc' },
    }),
    prisma.studentAttendance.findMany({
      where: { schoolId, cls, section, date },
    }),
  ]);

  const byStudent = new Map(existing.map((r) => [r.studentId, r]));

  const roster = students.map((s) => {
    const mark = byStudent.get(s.id);
    return {
      studentId: s.id,
      student: s.name,
      studentCode: s.studentId || null,
      cls: s.cls,
      section: s.section,
      branchId: s.branchId || null,
      date,
      status: mark?.status || 'Present',
      remark: mark?.remark || '',
      attendanceId: mark?.id || null,
      marked: Boolean(mark),
    };
  });

  return { date, cls, section, roster, markedCount: existing.length };
}

async function markStudentAttendance(schoolId, input, auth) {
  const date = normalizeDate(input.date);
  const cls = trimmed(input.cls);
  const section = trimmed(input.section);
  const records = Array.isArray(input.records) ? input.records : [];

  if (!cls) throw badRequest('Class is required.');
  if (!section) throw badRequest('Section is required.');
  if (records.length === 0) throw badRequest('At least one attendance record is required.');

  await assertCanMarkClass(schoolId, auth, cls);

  const studentIds = records.map((r) => trimmed(r.studentId)).filter(Boolean);
  if (studentIds.length === 0) throw badRequest('Each record needs a studentId.');

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      id: { in: studentIds },
      cls,
      section,
    },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const markerName = trimmed(auth?.name) || null;
  let markedBy = markerName;
  let markedById = auth?.userId || null;

  if (!markedBy && auth?.userId) {
    const user = await prisma.user.findFirst({
      where: { id: auth.userId, schoolId },
      select: { name: true },
    });
    markedBy = user?.name || null;
  }

  const branchId =
    input.branchId && input.branchId !== 'all'
      ? input.branchId
      : students[0]?.branchId || null;

  const results = [];

  for (const record of records) {
    const studentId = trimmed(record.studentId);
    const student = studentMap.get(studentId);
    if (!student) {
      throw badRequest(`Student ${studentId} is not in ${cls}-${section}.`);
    }

    const status = normalizeStatus(record.status || 'Present');
    const remark = trimmed(record.remark) || null;

    const row = await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: { schoolId, studentId, date },
      },
      create: {
        schoolId,
        branchId: student.branchId || branchId,
        studentId,
        studentName: student.name,
        studentCode: student.studentId || null,
        cls: student.cls,
        section: student.section,
        date,
        status,
        remark,
        markedById,
        markedBy,
      },
      update: {
        status,
        remark,
        studentName: student.name,
        studentCode: student.studentId || null,
        cls: student.cls,
        section: student.section,
        branchId: student.branchId || branchId,
        markedById,
        markedBy,
      },
    });

    results.push(serializeStudent(row));
  }

  return { date, cls, section, attendance: results };
}

async function listMyClassSections(schoolId, auth) {
  if (isAdminAuth(auth)) {
    const classes = await prisma.class.findMany({
      where: { schoolId, status: 'Active' },
      orderBy: { name: 'asc' },
    });
    return expandClassSections(classes);
  }

  const employee = await resolveEmployeeForUser(schoolId, auth);
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
    orderBy: { name: 'asc' },
  });

  return expandClassSections(classes, employee);
}

function expandClassSections(classes, employee = null) {
  const out = [];
  for (const c of classes) {
    const sections = Array.isArray(c.sections) ? c.sections : ['A'];
    for (const section of sections) {
      out.push({
        label: `${c.name}-${section}`,
        cls: c.name,
        section,
        classId: c.id,
        branchId: c.branchId || null,
        teacherId: c.teacherId || employee?.id || null,
        teacher: c.teacher || employee?.name || null,
      });
    }
  }
  return out;
}

async function listStaffAttendance(schoolId, query = {}, auth = null) {
  if (!canMarkStaffAttendance(auth)) {
    throw forbidden('Only office/admin staff can view employee attendance.');
  }

  const where = { schoolId };

  if (query.branchId && query.branchId !== 'all') where.branchId = query.branchId;
  if (query.employeeId) where.employeeId = trimmed(query.employeeId);
  if (query.status) where.status = normalizeStatus(query.status);

  if (query.date) {
    where.date = normalizeDate(query.date);
  } else if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = normalizeDate(query.from);
    if (query.to) where.date.lte = normalizeDate(query.to);
  }

  const rows = await prisma.staffAttendance.findMany({
    where,
    orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
  });

  return rows.map(serializeStaff);
}

async function getStaffRoster(schoolId, query = {}, auth) {
  if (!canMarkStaffAttendance(auth)) {
    throw forbidden('Only office/admin staff can mark employee attendance (not teachers or students).');
  }

  const date = normalizeDate(query.date);
  const empWhere = { schoolId, status: 'Active' };
  if (query.branchId && query.branchId !== 'all') {
    empWhere.OR = [{ branchId: query.branchId }, { branchId: null }];
  }

  const [employees, existing] = await Promise.all([
    prisma.employee.findMany({ where: empWhere, orderBy: { name: 'asc' } }),
    prisma.staffAttendance.findMany({
      where: {
        schoolId,
        date,
        ...(query.branchId && query.branchId !== 'all' ? { branchId: query.branchId } : {}),
      },
    }),
  ]);

  const byEmp = new Map(existing.map((r) => [r.employeeId, r]));

  const roster = employees.map((e) => {
    const mark = byEmp.get(e.id);
    return {
      employeeId: e.id,
      employee: e.name,
      employeeCode: e.employeeId || null,
      designation: e.designation || '',
      department: e.department || '',
      branchId: e.branchId || null,
      date,
      status: mark?.status || 'Present',
      inTime: mark?.inTime || '',
      outTime: mark?.outTime || '',
      remark: mark?.remark || '',
      attendanceId: mark?.id || null,
      marked: Boolean(mark),
    };
  });

  return { date, roster, markedCount: existing.length };
}

async function markStaffAttendance(schoolId, input, auth) {
  if (!canMarkStaffAttendance(auth)) {
    throw forbidden('Only office/admin staff can mark employee attendance (not teachers or students).');
  }

  const date = normalizeDate(input.date);
  const records = Array.isArray(input.records) ? input.records : [];
  if (records.length === 0) throw badRequest('At least one attendance record is required.');

  const employeeIds = records.map((r) => trimmed(r.employeeId)).filter(Boolean);
  const employees = await prisma.employee.findMany({
    where: { schoolId, id: { in: employeeIds } },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  let markedBy = trimmed(auth?.name) || null;
  const markedById = auth?.userId || null;
  if (!markedBy && auth?.userId) {
    const user = await prisma.user.findFirst({
      where: { id: auth.userId, schoolId },
      select: { name: true },
    });
    markedBy = user?.name || null;
  }

  const results = [];

  for (const record of records) {
    const employeeId = trimmed(record.employeeId);
    const employee = empMap.get(employeeId);
    if (!employee) throw badRequest(`Employee ${employeeId} was not found.`);

    const status = normalizeStatus(record.status || 'Present');
    const remark = trimmed(record.remark) || null;
    const inTime = trimmed(record.inTime) || null;
    const outTime = trimmed(record.outTime) || null;
    const branchId =
      (input.branchId && input.branchId !== 'all' ? input.branchId : null) ||
      employee.branchId ||
      null;

    const row = await prisma.staffAttendance.upsert({
      where: {
        schoolId_employeeId_date: { schoolId, employeeId, date },
      },
      create: {
        schoolId,
        branchId,
        employeeId,
        employeeName: employee.name,
        employeeCode: employee.employeeId || null,
        designation: employee.designation || null,
        department: employee.department || null,
        date,
        status,
        inTime,
        outTime,
        remark,
        markedById,
        markedBy,
      },
      update: {
        status,
        inTime,
        outTime,
        remark,
        employeeName: employee.name,
        employeeCode: employee.employeeId || null,
        designation: employee.designation || null,
        department: employee.department || null,
        branchId,
        markedById,
        markedBy,
      },
    });

    results.push(serializeStaff(row));
  }

  return { date, attendance: results };
}

async function listMyStudentAttendance(schoolId, auth, query = {}) {
  if (!auth?.userId) throw forbidden('Authentication required.');

  const user = await prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { email: true, name: true },
  });
  if (!user) throw notFound('User not found.');

  const student =
    (await prisma.student.findFirst({
      where: {
        schoolId,
        email: { equals: user.email, mode: 'insensitive' },
      },
    })) ||
    (await prisma.student.findFirst({
      where: {
        schoolId,
        name: { equals: user.name, mode: 'insensitive' },
      },
    }));

  if (!student) {
    return [];
  }

  return listStudentAttendance(schoolId, {
    ...query,
    studentId: student.id,
  });
}

module.exports = {
  listStudentAttendance,
  getStudentRoster,
  markStudentAttendance,
  listMyClassSections,
  listStaffAttendance,
  getStaffRoster,
  markStaffAttendance,
  listMyStudentAttendance,
  STATUSES: [...STATUSES],
};
