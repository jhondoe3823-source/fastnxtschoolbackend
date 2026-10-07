/**
 * Subject service — manage curriculum subjects and class/teacher subject assignments.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

function serializeSubject(s, assignedClassesCount = 0) {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type || 'Core',
    description: s.description || '',
    classes: assignedClassesCount,
    status: s.status || 'Active',
    branchId: s.branchId || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function serializeAssignment(a) {
  if (!a) return null;
  return {
    id: a.id,
    cls: a.className,
    section: a.section,
    subject: a.subjectName,
    teacher: a.teacherName,
    date: a.date || (a.createdAt ? a.createdAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
    classId: a.classId || null,
    subjectId: a.subjectId || null,
    teacherId: a.teacherId || null,
    status: a.status || 'Active',
    branchId: a.branchId || null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function listSubjects(schoolId, { q, type, status, branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status && status !== 'All') where.status = status;
  if (type) where.type = type;

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { code: { contains: query, mode: 'insensitive' } },
    ];
  }

  const subjects = await prisma.subject.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  // Calculate assigned classes count per subject
  const allAssignments = await prisma.subjectAssignment.findMany({
    where: { schoolId },
    select: { subjectName: true, className: true },
  });

  const classCountMap = {};
  allAssignments.forEach(({ subjectName, className }) => {
    const key = subjectName.toLowerCase();
    if (!classCountMap[key]) classCountMap[key] = new Set();
    classCountMap[key].add(className);
  });

  return subjects.map((s) => {
    const count = classCountMap[s.name.toLowerCase()]?.size || 0;
    return serializeSubject(s, count);
  });
}

async function getSubject(schoolId, id) {
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) throw notFound('Subject not found.');

  const assignments = await prisma.subjectAssignment.findMany({
    where: { schoolId, subjectName: subject.name },
    select: { className: true },
  });
  const uniqueClasses = new Set(assignments.map((a) => a.className)).size;
  return serializeSubject(subject, uniqueClasses);
}

async function createSubject(schoolId, input) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Subject name is required.');

  const code = trimmed(input.code).toUpperCase() || name.substring(0, 4).toUpperCase();
  const type = trimmed(input.type) || 'Core';
  const description = trimmed(input.description) || null;
  const status = trimmed(input.status) || 'Active';

  const branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  const subject = await prisma.subject.create({
    data: {
      schoolId,
      branchId,
      name,
      code,
      type,
      description,
      status,
    },
  });

  return serializeSubject(subject, 0);
}

async function updateSubject(schoolId, id, input) {
  const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Subject not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.code !== undefined) data.code = trimmed(input.code).toUpperCase();
  if (input.type !== undefined) data.type = trimmed(input.type);
  if (input.description !== undefined) data.description = trimmed(input.description) || null;
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  const updated = await prisma.subject.update({
    where: { id },
    data,
  });

  if (data.name && data.name !== existing.name) {
    await prisma.subjectAssignment.updateMany({
      where: { schoolId, subjectName: existing.name },
      data: { subjectName: data.name },
    });
  }

  const assignments = await prisma.subjectAssignment.findMany({
    where: { schoolId, subjectName: updated.name },
    select: { className: true },
  });
  const uniqueClasses = new Set(assignments.map((a) => a.className)).size;

  return serializeSubject(updated, uniqueClasses);
}

async function deleteSubject(schoolId, id) {
  const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Subject not found.');

  await prisma.subjectAssignment.deleteMany({
    where: { schoolId, subjectName: existing.name },
  });

  await prisma.subject.delete({ where: { id } });
  return { id, deleted: true };
}

// ================= ASSIGNMENTS =================

async function listAssignments(schoolId, { q, cls, section, status, branchId, teacher } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (cls && cls !== 'All') where.className = cls;
  if (section) where.section = section;
  if (status && status !== 'All') where.status = status;
  if (teacher) where.teacherName = { contains: trimmed(teacher), mode: 'insensitive' };

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { subjectName: { contains: query, mode: 'insensitive' } },
      { teacherName: { contains: query, mode: 'insensitive' } },
      { className: { contains: query, mode: 'insensitive' } },
    ];
  }

  const assignments = await prisma.subjectAssignment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return assignments.map(serializeAssignment);
}

async function createAssignment(schoolId, input) {
  const className = trimmed(input.cls || input.className);
  const section = trimmed(input.section) || 'A';
  const subjectName = trimmed(input.subject || input.subjectName);
  const teacherName = trimmed(input.teacher || input.teacherName);

  if (!className) throw badRequest('Class is required.');
  if (!subjectName) throw badRequest('Subject is required.');
  if (!teacherName) throw badRequest('Teacher is required.');

  const existing = await prisma.subjectAssignment.findFirst({
    where: {
      schoolId,
      className,
      section,
      subjectName,
    },
  });

  if (existing) {
    const updated = await prisma.subjectAssignment.update({
      where: { id: existing.id },
      data: {
        teacherName,
        date: trimmed(input.date) || new Date().toISOString().slice(0, 10),
      },
    });
    return serializeAssignment(updated);
  }

  const assignment = await prisma.subjectAssignment.create({
    data: {
      schoolId,
      branchId: input.branchId || null,
      className,
      section,
      subjectName,
      teacherName,
      date: trimmed(input.date) || new Date().toISOString().slice(0, 10),
      classId: input.classId || null,
      subjectId: input.subjectId || null,
      teacherId: input.teacherId || null,
      status: 'Active',
    },
  });

  return serializeAssignment(assignment);
}

async function deleteAssignment(schoolId, id) {
  const existing = await prisma.subjectAssignment.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Assignment not found.');

  await prisma.subjectAssignment.delete({ where: { id } });
  return { id, deleted: true };
}

/**
 * Overview of classes with their assigned subjects
 */
async function listClassesWithSubjects(schoolId, { q, section, status, branchId } = {}) {
  const classWhere = { schoolId };
  if (branchId && branchId !== 'all') classWhere.branchId = branchId;
  if (status && status !== 'All') classWhere.status = status;
  if (q) {
    classWhere.name = { contains: trimmed(q), mode: 'insensitive' };
  }

  const classes = await prisma.class.findMany({
    where: classWhere,
    orderBy: { createdAt: 'desc' },
  });

  const assignments = await prisma.subjectAssignment.findMany({
    where: { schoolId },
    select: { className: true, section: true, subjectName: true },
  });

  const classSubjectsMap = {};
  assignments.forEach(({ className, subjectName }) => {
    if (!classSubjectsMap[className]) classSubjectsMap[className] = new Set();
    classSubjectsMap[className].add(subjectName);
  });

  let results = classes.map((c) => {
    const rawSections = Array.isArray(c.sections) ? c.sections : ['A'];
    const assignedSubjects = Array.from(classSubjectsMap[c.name] || []);

    return {
      id: c.id,
      name: c.name,
      code: c.code,
      session: c.session || '2025-2026',
      sections: rawSections,
      teacher: c.teacher || 'Unassigned',
      students: c.students || 0,
      status: c.status || 'Active',
      subjects: assignedSubjects,
      createdAt: c.createdAt,
    };
  });

  if (section) {
    results = results.filter((c) => c.sections.includes(section));
  }

  return results;
}

module.exports = {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  listAssignments,
  createAssignment,
  deleteAssignment,
  listClassesWithSubjects,
};
