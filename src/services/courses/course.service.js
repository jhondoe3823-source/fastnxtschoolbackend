/**
 * Per-school course catalog.
 * A Plus Institute also receives its IT and nursing courses automatically.
 */

const { prisma } = require('../../config/database');
const { badRequest, notFound } = require('../../utils/errors');
const { looksLikeAplInstitute } = require('../admissions/admission-form-config.service');

const CATEGORIES = new Set(['general', 'law', 'it', 'nursing']);

const APL_IT_COURSES = [
  'Web Design',
  'Digital Marketing',
  'YouTube Learning',
  'Google AdSense',
  'Shopify',
  'Amazon',
  'eBay',
  'Etsy',
  'Walmart',
  'OnBuy',
  'SMC',
  'C and C++',
  'TikTok Seller',
  'Graphic Design',
  'Front Desk Operator',
  'Computer Hardware',
];

const APL_LAW_COURSES = [
  { name: 'LLB (5 Years)', duration: '5 years' },
  { name: 'LLB (4 Years)', duration: '4 years' },
];

const APL_NURSING_COURSES = [
  { name: 'BS Nursing (3 years)', duration: '3 years' },
  { name: 'B Category (2 years)', duration: '2 years' },
];

const trimmed = (value) => String(value ?? '').trim();

function serializeCourse(course) {
  if (!course) return null;
  return {
    id: course.id,
    name: course.name,
    category: course.category || 'general',
    duration: course.duration || '',
    status: course.status || 'Active',
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function courseClassCode(name) {
  const compact = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8);
  return compact || 'COURSE';
}

/**
 * Keep a Class row for every Course so fee structure, attendance, timetable
 * and teacher assignment can use the same class/section flow.
 */
async function syncCourseClasses(schoolId) {
  const courses = await prisma.course.findMany({
    where: { schoolId, status: 'Active' },
    select: { name: true, category: true, duration: true },
  });
  if (!courses.length) return;

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true, sections: true, description: true },
  });
  const byName = new Map(classes.map((row) => [row.name.toLowerCase(), row]));

  for (const course of courses) {
    const key = course.name.toLowerCase();
    const existing = byName.get(key);
    const description = [
      'Synced from course catalog',
      course.category ? `category: ${course.category}` : '',
      course.duration ? `duration: ${course.duration}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    if (!existing) {
      await prisma.class.create({
        data: {
          schoolId,
          name: course.name,
          code: courseClassCode(course.name),
          session: '2025-2026',
          sections: ['A'],
          teacher: 'Unassigned',
          students: 0,
          description,
          status: 'Active',
        },
      });
      continue;
    }

    const sections = Array.isArray(existing.sections) ? existing.sections : [];
    const needsSection = !sections.includes('A');
    if (needsSection || !existing.description) {
      await prisma.class.update({
        where: { id: existing.id },
        data: {
          sections: needsSection ? [...sections, 'A'] : existing.sections,
          description: existing.description || description,
          status: 'Active',
        },
      });
    }
  }
}

async function ensureAplCourses(schoolId) {
  const existing = await prisma.course.findMany({
    where: { schoolId },
    select: { name: true },
  });
  const have = new Set(existing.map((row) => row.name.toLowerCase()));
  const missing = [
    ...APL_LAW_COURSES.filter((row) => !have.has(row.name.toLowerCase())).map((row) => ({
      schoolId,
      name: row.name,
      category: 'law',
      duration: row.duration,
      status: 'Active',
    })),
    ...APL_IT_COURSES.filter((name) => !have.has(name.toLowerCase())).map((name) => ({
      schoolId,
      name,
      category: 'it',
      status: 'Active',
    })),
    ...APL_NURSING_COURSES.filter((row) => !have.has(row.name.toLowerCase())).map((row) => ({
      schoolId,
      name: row.name,
      category: 'nursing',
      duration: row.duration,
      status: 'Active',
    })),
  ];
  if (missing.length) {
    await prisma.course.createMany({ data: missing });
  }
  await syncCourseClasses(schoolId);
}

async function listCourses(schoolId, { q, category, status } = {}) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (school && looksLikeAplInstitute(school)) {
    await ensureAplCourses(schoolId);
  } else {
    await syncCourseClasses(schoolId);
  }

  const where = { schoolId };
  if (category && category !== 'all' && CATEGORIES.has(category)) where.category = category;
  if (status && status !== 'All') where.status = status;
  if (q) where.name = { contains: trimmed(q), mode: 'insensitive' };

  const courses = await prisma.course.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return courses.map(serializeCourse);
}

async function createCourse(schoolId, input) {
  const name = trimmed(input.name);
  if (!name) throw badRequest('Course name is required.');
  const category = trimmed(input.category || 'general').toLowerCase();
  if (!CATEGORIES.has(category)) throw badRequest('Course category must be general, law, it, or nursing.');

  const duplicate = await prisma.course.findFirst({
    where: { schoolId, name: { equals: name, mode: 'insensitive' } },
  });
  if (duplicate) return serializeCourse(duplicate);

  const course = await prisma.course.create({
    data: {
      schoolId,
      name,
      category,
      duration: trimmed(input.duration) || null,
      status: trimmed(input.status) || 'Active',
    },
  });
  await syncCourseClasses(schoolId);
  return serializeCourse(course);
}

async function updateCourse(schoolId, id, input) {
  const existing = await prisma.course.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Course not found.');

  const data = {};
  if (input.name !== undefined) {
    const name = trimmed(input.name);
    if (!name) throw badRequest('Course name is required.');
    data.name = name;
  }
  if (input.category !== undefined) {
    const category = trimmed(input.category).toLowerCase();
    if (!CATEGORIES.has(category)) throw badRequest('Course category must be general, law, it, or nursing.');
    data.category = category;
  }
  if (input.duration !== undefined) data.duration = trimmed(input.duration) || null;
  if (input.status !== undefined) data.status = trimmed(input.status) || 'Active';

  const course = await prisma.course.update({ where: { id: existing.id }, data });
  if (data.name) {
    await prisma.student.updateMany({
      where: { schoolId, courseId: existing.id },
      data: { course: course.name, cls: course.name },
    });
    const matchedClass = await prisma.class.findFirst({
      where: { schoolId, name: { equals: existing.name, mode: 'insensitive' } },
    });
    if (matchedClass) {
      await prisma.class.update({
        where: { id: matchedClass.id },
        data: {
          name: course.name,
          code: courseClassCode(course.name),
          description: matchedClass.description || `Synced from course catalog · category: ${course.category}`,
        },
      });
    }
  }
  await syncCourseClasses(schoolId);
  return serializeCourse(course);
}

async function deleteCourse(schoolId, id) {
  const existing = await prisma.course.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Course not found.');
  await prisma.course.delete({ where: { id: existing.id } });
  return { deleted: true };
}

module.exports = {
  APL_IT_COURSES,
  APL_NURSING_COURSES,
  ensureAplCourses,
  syncCourseClasses,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
};
