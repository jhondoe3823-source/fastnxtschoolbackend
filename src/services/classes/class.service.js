/**
 * Class service — manage school classes, grade levels, sections, and class teachers.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serializeClass(cls) {
  if (!cls) return null;
  return {
    id: cls.id,
    name: cls.name,
    code: cls.code,
    session: cls.session || '2025-2026',
    sections: Array.isArray(cls.sections) ? cls.sections : ['A'],
    teacher: cls.teacher || 'Unassigned',
    teacherId: cls.teacherId || null,
    students: cls.students || 0,
    description: cls.description || '',
    status: cls.status || 'Active',
    branchId: cls.branchId || null,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
  };
}

/**
 * List employees suitable as class teachers.
 * First tries teaching-designation employees; falls back to all active employees.
 */
async function listTeachers(schoolId, branchId) {
  const where = { schoolId, status: 'Active' };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const teachers = await prisma.employee.findMany({
    where: {
      ...where,
      OR: [
        { designation: { contains: 'teacher', mode: 'insensitive' } },
        { designation: { contains: 'instructor', mode: 'insensitive' } },
        { designation: { contains: 'lecturer', mode: 'insensitive' } },
        { designation: { contains: 'tutor', mode: 'insensitive' } },
        { department: { contains: 'teaching', mode: 'insensitive' } },
        { department: { contains: 'academic', mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, designation: true, department: true, employeeId: true },
  });

  if (teachers.length === 0) {
    return prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, designation: true, department: true, employeeId: true },
    });
  }

  return teachers;
}

async function listClasses(schoolId, { q, section, status, branchId } = {}) {
  const where = { schoolId };

  if (branchId && branchId !== 'all') {
    where.OR = [
      { branchId },
      { branchId: null },
    ];
  }

  if (q) {
    const query = trimmed(q).toLowerCase();
    const qFilter = [
      { name: { contains: query, mode: 'insensitive' } },
      { code: { contains: query, mode: 'insensitive' } },
      { teacher: { contains: query, mode: 'insensitive' } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: qFilter }];
      delete where.OR;
    } else {
      where.OR = qFilter;
    }
  }

  if (status) where.status = status;

  const classes = await prisma.class.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  let results = classes.map(serializeClass);

  if (section) {
    results = results.filter((c) => c.sections.includes(section));
  }

  return results;
}

async function getClass(schoolId, id) {
  const cls = await prisma.class.findFirst({ where: { id, schoolId } });
  if (!cls) throw notFound('Class not found.');
  return serializeClass(cls);
}

async function createClass(schoolId, input) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Class name is required.');

  const code = trimmed(input.code).toUpperCase() || name.substring(0, 3).toUpperCase();
  const session = trimmed(input.session) || '2025-2026';
  const sections = Array.isArray(input.sections) && input.sections.length > 0 ? input.sections : ['A'];
  const description = trimmed(input.description) || null;
  const status = trimmed(input.status) || 'Active';

  // Resolve teacher name: if teacherId is provided, look up the employee name.
  let teacher = trimmed(input.teacher) || 'Unassigned';
  let teacherId = input.teacherId || null;
  if (teacherId) {
    const emp = await prisma.employee.findFirst({
      where: { id: teacherId, schoolId },
      select: { name: true },
    });
    if (emp) teacher = emp.name;
    else teacherId = null;
  }

  const cls = await prisma.class.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      name,
      code,
      session,
      sections,
      teacher,
      teacherId,
      students: Number(input.students) || 0,
      description,
      status,
    },
  });

  logger.info(`Created class "${cls.name}" (${cls.code}) for school ${schoolId}.`);
  return serializeClass(cls);
}

async function updateClass(schoolId, id, input) {
  const existing = await prisma.class.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Class not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.code !== undefined) data.code = trimmed(input.code).toUpperCase();
  if (input.session !== undefined) data.session = trimmed(input.session);
  if (input.sections !== undefined) data.sections = Array.isArray(input.sections) ? input.sections : [input.sections];
  if (input.description !== undefined) data.description = trimmed(input.description);
  if (input.students !== undefined) data.students = Number(input.students) || 0;
  if (input.status !== undefined) data.status = trimmed(input.status);

  // Resolve teacher name from employee ID if provided
  if (input.teacherId !== undefined) {
    if (input.teacherId) {
      const emp = await prisma.employee.findFirst({
        where: { id: input.teacherId, schoolId },
        select: { name: true },
      });
      data.teacherId = emp ? input.teacherId : null;
      data.teacher = emp ? emp.name : (trimmed(input.teacher) || existing.teacher);
    } else {
      data.teacherId = null;
      data.teacher = trimmed(input.teacher) || 'Unassigned';
    }
  } else if (input.teacher !== undefined) {
    data.teacher = trimmed(input.teacher);
  }

  const updated = await prisma.class.update({ where: { id }, data });
  logger.info(`Updated class "${updated.name}" (${updated.id}).`);
  return serializeClass(updated);
}

async function deleteClass(schoolId, id) {
  const existing = await prisma.class.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Class not found.');
  await prisma.class.delete({ where: { id } });
  logger.info(`Deleted class "${existing.name}" (${id}).`);
}

module.exports = {
  listClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  listTeachers,
  serializeClass,
};
