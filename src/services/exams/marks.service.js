/**
 * Exam marks entry, verification, publish + result announcement.
 */

const { prisma } = require('../../config/database');
const { badRequest, forbidden, notFound } = require('../../utils/errors');
const { createNotice } = require('../communication/notice.service');
const { createNotification } = require('../notifications/notification.service');
const emailService = require('../email/email.service');
const { PANELS } = require('../../constants/roles');

const trimmed = (val) => String(val ?? '').trim();

function isAdminAuth(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.ADMIN) return true;
  const role = String(auth.role || '').toLowerCase();
  return role.includes('admin') || role.includes('principal') || role.includes('owner');
}

function isTeacherAuth(auth) {
  if (!auth) return false;
  if (auth.panel === PANELS.TEACHER) return true;
  return String(auth.role || '').toLowerCase().includes('teacher');
}

function computeGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

function serializeMark(row) {
  const obtained = Number(row.obtained) || 0;
  const total = Number(row.total) || 100;
  const percentage = total > 0 ? Math.round((obtained / total) * 1000) / 10 : 0;
  return {
    id: row.id,
    examId: row.examId,
    slotId: row.slotId || null,
    branchId: row.branchId || null,
    studentId: row.studentId,
    student: row.studentName,
    studentCode: row.studentCode || null,
    cls: row.cls,
    section: row.section || '',
    subject: row.subject,
    obtained,
    total,
    percentage,
    grade: row.grade || computeGrade(percentage),
    remark: row.remark || '',
    enteredBy: row.enteredBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveEmployeeForUser(schoolId, auth) {
  if (!auth?.userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { name: true, email: true },
  });
  if (!user) return null;
  const employees = await prisma.employee.findMany({
    where: { schoolId, status: 'Active' },
    select: { id: true, name: true, email: true },
  });
  const emailLower = (user.email || '').toLowerCase();
  const nameLower = (user.name || '').toLowerCase();
  return (
    employees.find((e) => (e.email || '').toLowerCase() === emailLower) ||
    employees.find((e) => (e.name || '').toLowerCase() === nameLower) ||
    null
  );
}

async function assertCanEnterMarks(schoolId, auth, { cls, subject, teacherId }) {
  if (isAdminAuth(auth)) return;
  if (!isTeacherAuth(auth)) throw forbidden('Only teachers or admins can enter marks.');

  const employee = await resolveEmployeeForUser(schoolId, auth);
  if (!employee) throw forbidden('Teacher profile not linked.');

  if (teacherId && teacherId === employee.id) return;

  const assignment = await prisma.subjectAssignment.findFirst({
    where: {
      schoolId,
      teacherId: employee.id,
      className: cls,
      subjectName: { equals: subject, mode: 'insensitive' },
      status: 'Active',
    },
  }).catch(() => null);

  if (assignment) return;

  // Fallback: slot assigned to this teacher
  const slot = await prisma.examPaperSlot.findFirst({
    where: {
      schoolId,
      cls,
      subject: { equals: subject, mode: 'insensitive' },
      teacherId: employee.id,
    },
  });
  if (slot) return;

  throw forbidden('You can only enter marks for subjects assigned to you.');
}

async function getMarksRoster(schoolId, examId, query = {}, auth) {
  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');

  const cls = trimmed(query.cls);
  const section = trimmed(query.section);
  const subject = trimmed(query.subject);
  if (!cls) throw badRequest('Class is required.');
  if (!section) throw badRequest('Section is required.');
  if (!subject) throw badRequest('Subject is required.');

  const slot = await prisma.examPaperSlot.findFirst({
    where: {
      schoolId,
      examId,
      cls,
      subject: { equals: subject, mode: 'insensitive' },
      OR: [{ section: '' }, { section }, { section: { equals: section, mode: 'insensitive' } }],
    },
  });

  await assertCanEnterMarks(schoolId, auth, {
    cls,
    subject,
    teacherId: slot?.teacherId || null,
  });

  const studentWhere = { schoolId, cls, section, status: 'Active' };
  if (query.branchId && query.branchId !== 'all') {
    studentWhere.OR = [{ branchId: query.branchId }, { branchId: null }];
  }

  const [students, existing] = await Promise.all([
    prisma.student.findMany({ where: studentWhere, orderBy: { name: 'asc' } }),
    prisma.examMark.findMany({
      where: { schoolId, examId, cls, section, subject: { equals: subject, mode: 'insensitive' } },
    }),
  ]);

  const byStudent = new Map(existing.map((m) => [m.studentId, m]));
  const defaultTotal = 100;

  const roster = students.map((s) => {
    const mark = byStudent.get(s.id);
    const obtained = mark ? Number(mark.obtained) : null;
    const total = mark ? Number(mark.total) : defaultTotal;
    const percentage =
      obtained == null || !total ? null : Math.round((obtained / total) * 1000) / 10;
    return {
      studentId: s.id,
      student: s.name,
      studentCode: s.studentId || null,
      cls: s.cls,
      section: s.section,
      subject,
      slotId: slot?.id || null,
      obtained,
      total,
      percentage,
      grade: mark?.grade || (percentage == null ? null : computeGrade(percentage)),
      remark: mark?.remark || '',
      marked: Boolean(mark),
      markId: mark?.id || null,
    };
  });

  return {
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      session: exam.session,
      status: exam.status,
      resultAnnounceDate: exam.resultAnnounceDate || null,
      publishedAt: exam.publishedAt || null,
    },
    cls,
    section,
    subject,
    slotId: slot?.id || null,
    roster,
    markedCount: existing.length,
  };
}

async function saveMarks(schoolId, examId, input, auth) {
  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');
  if (exam.status === 'Published' && !isAdminAuth(auth)) {
    throw forbidden('Results are published. Only admin can edit marks.');
  }

  const cls = trimmed(input.cls);
  const section = trimmed(input.section);
  const subject = trimmed(input.subject);
  const records = Array.isArray(input.records) ? input.records : [];
  if (!cls || !section || !subject) throw badRequest('Class, section and subject are required.');
  if (!records.length) throw badRequest('At least one mark record is required.');

  const slot = await prisma.examPaperSlot.findFirst({
    where: {
      schoolId,
      examId,
      cls,
      subject: { equals: subject, mode: 'insensitive' },
    },
  });

  await assertCanEnterMarks(schoolId, auth, {
    cls,
    subject,
    teacherId: slot?.teacherId || null,
  });

  const studentIds = records.map((r) => trimmed(r.studentId)).filter(Boolean);
  const students = await prisma.student.findMany({
    where: { schoolId, id: { in: studentIds }, cls, section },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  let enteredBy = trimmed(auth?.name) || null;
  const enteredById = auth?.userId || null;
  if (!enteredBy && auth?.userId) {
    const user = await prisma.user.findFirst({
      where: { id: auth.userId, schoolId },
      select: { name: true },
    });
    enteredBy = user?.name || null;
  }

  const saved = [];
  for (const record of records) {
    const studentId = trimmed(record.studentId);
    const student = studentMap.get(studentId);
    if (!student) throw badRequest(`Student ${studentId} is not in ${cls}-${section}.`);

    const obtained = Math.max(0, Number(record.obtained) || 0);
    const total = Math.max(1, Number(record.total) || 100);
    if (obtained > total) throw badRequest(`Obtained marks cannot exceed total for ${student.name}.`);
    const percentage = Math.round((obtained / total) * 1000) / 10;
    const grade = trimmed(record.grade) || computeGrade(percentage);
    const remark = trimmed(record.remark) || null;

    const row = await prisma.examMark.upsert({
      where: {
        schoolId_examId_studentId_subject_cls_section: {
          schoolId,
          examId,
          studentId,
          subject,
          cls,
          section,
        },
      },
      create: {
        schoolId,
        examId,
        slotId: slot?.id || trimmed(input.slotId) || null,
        branchId: student.branchId || exam.branchId || null,
        studentId,
        studentName: student.name,
        studentCode: student.studentId || null,
        cls,
        section,
        subject,
        obtained,
        total,
        grade,
        remark,
        enteredById,
        enteredBy,
      },
      update: {
        obtained,
        total,
        grade,
        remark,
        studentName: student.name,
        studentCode: student.studentId || null,
        slotId: slot?.id || trimmed(input.slotId) || null,
        enteredById,
        enteredBy,
      },
    });
    saved.push(serializeMark(row));
  }

  if (['Draft', 'Notified', 'Scheduled'].includes(exam.status)) {
    await prisma.exam.update({
      where: { id: exam.id },
      data: { status: 'Marks Entry' },
    });
  }

  return { examId, cls, section, subject, marks: saved };
}

async function listResults(schoolId, query = {}, auth) {
  const where = { schoolId };
  if (query.examId) where.examId = trimmed(query.examId);
  if (query.studentId) where.studentId = trimmed(query.studentId);
  if (query.cls) where.cls = trimmed(query.cls);
  if (query.section) where.section = trimmed(query.section);
  if (query.branchId && query.branchId !== 'all') where.branchId = query.branchId;

  const examWhere = { schoolId };
  if (query.examId) examWhere.id = trimmed(query.examId);
  if (!isAdminAuth(auth) && !isTeacherAuth(auth)) {
    examWhere.status = 'Published';
  } else if (query.publishedOnly === 'true' || query.publishedOnly === true) {
    examWhere.status = 'Published';
  }

  const exams = await prisma.exam.findMany({
    where: examWhere,
    orderBy: { startDate: 'desc' },
  });
  const examIds = exams.map((e) => e.id);
  if (!examIds.length) return [];

  where.examId = query.examId ? trimmed(query.examId) : { in: examIds };

  const marks = await prisma.examMark.findMany({
    where,
    orderBy: [{ cls: 'asc' }, { section: 'asc' }, { studentName: 'asc' }, { subject: 'asc' }],
  });

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const byStudentExam = new Map();

  for (const m of marks) {
    const key = `${m.examId}:${m.studentId}`;
    if (!byStudentExam.has(key)) {
      byStudentExam.set(key, {
        examId: m.examId,
        exam: examMap.get(m.examId)?.name || '',
        studentId: m.studentId,
        student: m.studentName,
        studentCode: m.studentCode || null,
        cls: m.cls,
        section: m.section,
        branchId: m.branchId || null,
        subjects: [],
        obtained: 0,
        total: 0,
        status: examMap.get(m.examId)?.status || '',
        publishedAt: examMap.get(m.examId)?.publishedAt || null,
        resultAnnounceDate: examMap.get(m.examId)?.resultAnnounceDate || null,
      });
    }
    const agg = byStudentExam.get(key);
    agg.subjects.push({
      subject: m.subject,
      obtained: m.obtained,
      total: m.total,
      grade: m.grade || computeGrade(m.total ? (m.obtained / m.total) * 100 : 0),
    });
    agg.obtained += Number(m.obtained) || 0;
    agg.total += Number(m.total) || 0;
  }

  const results = [...byStudentExam.values()].map((r) => {
    const percentage = r.total > 0 ? Math.round((r.obtained / r.total) * 1000) / 10 : 0;
    return {
      ...r,
      percentage,
      grade: computeGrade(percentage),
      position: 0,
    };
  });

  // Class position within exam+cls+section
  const groups = new Map();
  for (const r of results) {
    const gkey = `${r.examId}:${r.cls}:${r.section}`;
    if (!groups.has(gkey)) groups.set(gkey, []);
    groups.get(gkey).push(r);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.percentage - a.percentage);
    group.forEach((r, i) => {
      r.position = i + 1;
    });
  }

  return results.sort((a, b) => a.position - b.position);
}

async function listMyResults(schoolId, auth) {
  if (!auth?.userId) throw forbidden('Authentication required.');
  const user = await prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { email: true, name: true },
  });
  if (!user) throw notFound('User not found.');

  const student =
    (await prisma.student.findFirst({
      where: { schoolId, email: { equals: user.email, mode: 'insensitive' } },
    })) ||
    (await prisma.student.findFirst({
      where: { schoolId, name: { equals: user.name, mode: 'insensitive' } },
    }));

  if (!student) return [];

  const all = await listResults(schoolId, { publishedOnly: true }, { panel: PANELS.STUDENT });
  return all.filter((r) => r.studentId === student.id);
}

async function verifyExam(schoolId, examId, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can verify results.');
  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');
  const count = await prisma.examMark.count({ where: { schoolId, examId } });
  if (!count) throw badRequest('Enter marks before verification.');

  const updated = await prisma.exam.update({
    where: { id: exam.id },
    data: { status: 'Verification' },
  });
  return updated;
}

async function publishResults(schoolId, examId, input = {}, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can publish results.');
  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');

  const count = await prisma.examMark.count({ where: { schoolId, examId } });
  if (!count) throw badRequest('No marks found to publish.');

  const today = new Date().toISOString().slice(0, 10);
  const announceDate = trimmed(input.resultAnnounceDate) || today;
  const sendEmail = input.sendEmail === true || input.sendEmail === 'true';

  const updated = await prisma.exam.update({
    where: { id: exam.id },
    data: {
      status: 'Published',
      publishedAt: today,
      resultAnnounceDate: announceDate,
    },
  });

  await createNotice(schoolId, {
    title: `Result announced: ${exam.name}`,
    content: `Results for ${exam.name} (${exam.type}) have been published. Announcement date: ${announceDate}. Students can view marks in the Student Portal.`,
    audience: 'Students',
    channel: 'App',
    type: 'Result',
    status: 'Published',
    author: auth?.name || 'Admin',
    authorId: auth?.userId || null,
    branchId: exam.branchId,
  });

  // Notify student users linked by email
  const marks = await prisma.examMark.findMany({
    where: { schoolId, examId },
    select: { studentId: true, studentName: true },
    distinct: ['studentId'],
  });
  const studentIds = marks.map((m) => m.studentId);
  const students = await prisma.student.findMany({
    where: { schoolId, id: { in: studentIds } },
    select: { id: true, name: true, email: true },
  });

  const school = await prisma.school.findFirst({
    where: { id: schoolId },
    select: { id: true, name: true, logoUrl: true, email: true },
  });

  let emailsSent = 0;
  for (const student of students) {
    if (student.email) {
      const user = await prisma.user.findFirst({
        where: { schoolId, email: { equals: student.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (user) {
        await createNotification({
          schoolId,
          userId: user.id,
          title: `Results published — ${exam.name}`,
          message: `Your results for ${exam.name} are now available in the Student Portal.`,
          icon: 'result',
          tone: 'green',
          href: '/student/results',
        }).catch(() => null);
      }

      if (sendEmail) {
        const result = await emailService
          .sendSchoolEmail({
            to: student.email,
            school,
            title: `Result announced: ${exam.name}`,
            messageHtml: `<p>Dear ${student.name},</p><p>Results for <strong>${exam.name}</strong> (${exam.type}) have been published on ${announceDate}.</p><p>Please sign in to the Student Portal to view your marks and grade.</p>`,
            userId: user?.id || null,
            template: 'exam_result',
          })
          .catch(() => null);
        if (result?.delivered) emailsSent += 1;
      }
    }
  }

  return {
    exam: {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      publishedAt: updated.publishedAt,
      resultAnnounceDate: updated.resultAnnounceDate,
    },
    studentsNotified: students.length,
    emailsSent,
  };
}

async function listMarkSubjects(schoolId, examId, auth) {
  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');

  const slots = await prisma.examPaperSlot.findMany({
    where: { schoolId, examId },
    orderBy: [{ cls: 'asc' }, { subject: 'asc' }],
  });

  let filtered = slots;
  if (!isAdminAuth(auth) && isTeacherAuth(auth)) {
    const employee = await resolveEmployeeForUser(schoolId, auth);
    if (!employee) return [];
    filtered = slots.filter(
      (s) =>
        s.teacherId === employee.id ||
        (s.teacherName || '').toLowerCase() === (employee.name || '').toLowerCase()
    );
  }

  return filtered.map((s) => ({
    slotId: s.id,
    cls: s.cls,
    section: s.section || '',
    subject: s.subject,
    date: s.date,
    teacherId: s.teacherId || null,
    teacherName: s.teacherName || '',
  }));
}

module.exports = {
  getMarksRoster,
  saveMarks,
  listResults,
  listMyResults,
  verifyExam,
  publishResults,
  listMarkSubjects,
  computeGrade,
};
