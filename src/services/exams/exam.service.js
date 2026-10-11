/**
 * Exam lifecycle:
 * 1) Admin creates exam (type + dates) and notifies teachers
 * 2) Admin builds class-wise paper timetable (slots)
 * 3) Teachers submit question papers (file/image) within submit window
 */

const { prisma } = require('../../config/database');
const { notFound, badRequest, forbidden } = require('../../utils/errors');
const { createNotice } = require('../communication/notice.service');
const { createNotification } = require('../notifications/notification.service');
const emailService = require('../email/email.service');
const { PANELS } = require('../../constants/roles');

const trimmed = (val) => String(val ?? '').trim();
const EXAM_TYPES = ['Monthly', 'Mid-Term', 'Final', 'Quiz', 'Other'];
const EXAM_STATUSES = ['Draft', 'Notified', 'Scheduled', 'Marks Entry', 'Verification', 'Published'];

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

function normalizeClasses(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((c) => trimmed(c)).filter(Boolean))];
  }
  if (typeof input === 'string' && input.trim()) {
    return [...new Set(input.split(',').map((c) => trimmed(c)).filter(Boolean))];
  }
  return [];
}

function serializeFiles(files) {
  const { normalizeCloudAttachments } = require('../../utils/attachments');
  // Prefer Cloudinary URLs. Legacy base64 rows may still exist in DB — expose
  // them without re-requiring `data` on new writes.
  if (!Array.isArray(files)) return [];
  const cloud = normalizeCloudAttachments(
    files.filter((f) => f && f.url),
    { required: false }
  );
  if (cloud.length) return cloud;
  return files
    .filter((f) => f && typeof f === 'object' && (f.url || f.data))
    .map((f) => ({
      name: trimmed(f.name) || 'file',
      type: trimmed(f.type) || 'application/octet-stream',
      size: Number(f.size) || 0,
      ...(f.url ? { url: String(f.url), publicId: f.publicId || undefined } : { data: String(f.data) }),
    }));
}

function serializeSlot(r, examName) {
  return {
    id: r.id,
    examId: r.examId,
    exam: examName || r.exam?.name || '',
    branchId: r.branchId || null,
    cls: r.cls,
    section: r.section || '',
    subject: r.subject,
    subjectId: r.subjectId || null,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    room: r.room || '',
    invigilator: r.invigilator || '',
    teacherId: r.teacherId || null,
    teacherName: r.teacherName || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializeSubmission(r) {
  return {
    id: r.id,
    examId: r.examId,
    exam: r.exam?.name || '',
    slotId: r.slotId || null,
    branchId: r.branchId || null,
    cls: r.cls,
    section: r.section || '',
    subject: r.subject,
    teacherId: r.teacherId || null,
    teacherName: r.teacherName,
    employeeId: r.employeeId || null,
    status: r.status,
    note: r.note || '',
    files: serializeFiles(r.files),
    submittedAt: r.submittedAt || null,
    reviewedAt: r.reviewedAt || null,
    reviewedBy: r.reviewedBy || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializeExam(r, extras = {}) {
  const classes = Array.isArray(r.classes) ? r.classes : [];
  return {
    id: r.id,
    branchId: r.branchId || null,
    name: r.name,
    type: r.type,
    session: r.session,
    startDate: r.startDate,
    endDate: r.endDate,
    paperSubmitFrom: r.paperSubmitFrom || '',
    paperSubmitTo: r.paperSubmitTo || '',
    classes,
    classesCount: r.classesCount || classes.length,
    status: r.status,
    notifyNote: r.notifyNote || '',
    notifiedAt: r.notifiedAt || null,
    resultAnnounceDate: r.resultAnnounceDate || null,
    publishedAt: r.publishedAt || null,
    slotsCount: extras.slotsCount ?? (Array.isArray(r.slots) ? r.slots.length : undefined),
    submissionsCount:
      extras.submissionsCount ?? (Array.isArray(r.submissions) ? r.submissions.length : undefined),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
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
    select: { id: true, name: true, email: true, employeeId: true, branchId: true },
  });

  const emailLower = (user.email || '').toLowerCase();
  const nameLower = (user.name || '').toLowerCase();

  return (
    employees.find((e) => (e.email || '').toLowerCase() === emailLower) ||
    employees.find((e) => (e.name || '').toLowerCase() === nameLower) ||
    null
  );
}

async function findSubjectTeacher(schoolId, { cls, section, subject, branchId }) {
  const where = {
    schoolId,
    status: 'Active',
    className: { equals: cls, mode: 'insensitive' },
    subjectName: { equals: subject, mode: 'insensitive' },
  };
  if (branchId && branchId !== 'all') where.branchId = branchId;

  const rows = await prisma.subjectAssignment.findMany({ where, orderBy: { updatedAt: 'desc' } });
  if (!rows.length) return { teacherId: null, teacherName: null };

  const sec = trimmed(section);
  const match =
    (sec && rows.find((r) => trimmed(r.section).toLowerCase() === sec.toLowerCase())) ||
    rows[0];

  return {
    teacherId: match.teacherId || null,
    teacherName: match.teacherName || null,
  };
}

async function refreshExamClasses(schoolId, examId) {
  const slots = await prisma.examPaperSlot.findMany({
    where: { schoolId, examId },
    select: { cls: true },
  });
  const classes = [...new Set(slots.map((s) => s.cls).filter(Boolean))];
  await prisma.exam.update({
    where: { id: examId },
    data: { classes, classesCount: classes.length },
  });
  return classes;
}

async function listExams(schoolId, { branchId, status, session } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status) where.status = status;
  if (session) where.session = session;

  const rows = await prisma.exam.findMany({
    where,
    include: {
      _count: { select: { slots: true, submissions: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  return rows.map((r) =>
    serializeExam(r, {
      slotsCount: r._count.slots,
      submissionsCount: r._count.submissions,
    })
  );
}

async function getExam(schoolId, id) {
  const row = await prisma.exam.findFirst({
    where: { schoolId, id },
    include: {
      slots: { orderBy: [{ date: 'asc' }, { startTime: 'asc' }] },
      submissions: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!row) throw notFound('Exam not found.');

  return {
    exam: serializeExam(row, {
      slotsCount: row.slots.length,
      submissionsCount: row.submissions.length,
    }),
    slots: row.slots.map((s) => serializeSlot(s, row.name)),
    submissions: row.submissions.map(serializeSubmission),
  };
}

async function notifyTeachersForExam(schoolId, exam, auth) {
  const classesLabel =
    Array.isArray(exam.classes) && exam.classes.length ? exam.classes.join(', ') : 'all classes';
  const submitWindow =
    exam.paperSubmitFrom && exam.paperSubmitTo
      ? `Submit question papers from ${exam.paperSubmitFrom} to ${exam.paperSubmitTo}.`
      : exam.paperSubmitTo
        ? `Submit question papers by ${exam.paperSubmitTo}.`
        : 'Submit question papers before the exam start date.';

  const content = [
    `${exam.name} (${exam.type}) will run from ${exam.startDate} to ${exam.endDate} for ${classesLabel}.`,
    submitWindow,
    exam.notifyNote || '',
  ]
    .filter(Boolean)
    .join('\n\n');

  await createNotice(schoolId, {
    title: `Exam notice: ${exam.name}`,
    content,
    audience: 'Teachers',
    channel: 'App',
    type: 'Exam',
    status: 'Published',
    author: auth?.name || 'Admin',
    authorId: auth?.userId || null,
    branchId: exam.branchId,
  });

  // Also post a student-facing notice so date sheet awareness is school-wide.
  await createNotice(schoolId, {
    title: `${exam.name} — exams from ${exam.startDate}`,
    content: `${exam.name} (${exam.type}) will start from ${exam.startDate} and end on ${exam.endDate}. Classes: ${classesLabel}.`,
    audience: 'Students',
    channel: 'App',
    type: 'Exam',
    status: 'Published',
    author: auth?.name || 'Admin',
    authorId: auth?.userId || null,
    branchId: exam.branchId,
  });

  // Email + in-app notify teachers who have active employee logins
  const school = await prisma.school.findFirst({
    where: { id: schoolId },
    select: { id: true, name: true, logoUrl: true },
  });
  const teacherUsers = await prisma.user.findMany({
    where: {
      schoolId,
      panel: PANELS.TEACHER,
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  });

  const messageHtml = [
    `<p>${exam.name} (${exam.type}) will run from <strong>${exam.startDate}</strong> to <strong>${exam.endDate}</strong>.</p>`,
    `<p>Classes: ${classesLabel}</p>`,
    `<p>${submitWindow}</p>`,
    exam.notifyNote ? `<p>${exam.notifyNote}</p>` : '',
    `<p>Please prepare and submit question papers from the Teacher Portal → Exams.</p>`,
  ]
    .filter(Boolean)
    .join('');

  for (const tu of teacherUsers) {
    if (!tu.email) continue;
    await createNotification({
      schoolId,
      userId: tu.id,
      title: `Exam notice: ${exam.name}`,
      message: `${exam.name} (${exam.type}) — papers due by ${exam.paperSubmitTo || exam.startDate}.`,
      icon: 'exam',
      tone: 'orange',
      href: '/teacher/exams',
    }).catch(() => null);

    await emailService
      .sendSchoolEmail({
        to: tu.email,
        school,
        title: `Exam notice: ${exam.name}`,
        messageHtml,
        userId: tu.id,
        template: 'exam_notice',
        cta: { label: 'Open Teacher Portal', href: '/teacher/exams' },
      })
      .catch(() => null);
  }
}

async function createExam(schoolId, input, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can create exams.');

  const name = trimmed(input.name);
  if (!name) throw badRequest('Exam name is required.');
  const type = trimmed(input.type) || 'Mid-Term';
  if (!EXAM_TYPES.includes(type)) throw badRequest(`Invalid exam type. Use: ${EXAM_TYPES.join(', ')}`);
  const session = trimmed(input.session);
  if (!session) throw badRequest('Academic session is required.');
  const startDate = trimmed(input.startDate);
  const endDate = trimmed(input.endDate);
  if (!startDate || !endDate) throw badRequest('Start and end dates are required.');
  if (endDate < startDate) throw badRequest('End date cannot be before start date.');

  const classes = normalizeClasses(input.classes);
  const notify = input.notify === true || input.notify === 'true' || input.notifyTeachers === true;
  const today = new Date().toISOString().slice(0, 10);

  const paperSubmitFrom = trimmed(input.paperSubmitFrom) || today;
  const paperSubmitTo = trimmed(input.paperSubmitTo) || startDate;

  const row = await prisma.exam.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      name,
      type,
      session,
      startDate,
      endDate,
      paperSubmitFrom,
      paperSubmitTo,
      classes,
      classesCount: classes.length,
      status: notify ? 'Notified' : trimmed(input.status) || 'Draft',
      notifyNote: trimmed(input.notifyNote) || null,
      notifiedAt: notify ? today : null,
    },
  });

  if (notify) {
    await notifyTeachersForExam(schoolId, row, auth);
  }

  return serializeExam(row, { slotsCount: 0, submissionsCount: 0 });
}

async function updateExam(schoolId, id, input, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can update exams.');

  const existing = await prisma.exam.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Exam not found.');

  const data = {};
  if (input.name !== undefined) data.name = trimmed(input.name);
  if (input.type !== undefined) {
    const type = trimmed(input.type);
    if (!EXAM_TYPES.includes(type)) throw badRequest(`Invalid exam type.`);
    data.type = type;
  }
  if (input.session !== undefined) data.session = trimmed(input.session);
  if (input.startDate !== undefined) data.startDate = trimmed(input.startDate);
  if (input.endDate !== undefined) data.endDate = trimmed(input.endDate);
  if (input.paperSubmitFrom !== undefined) data.paperSubmitFrom = trimmed(input.paperSubmitFrom) || null;
  if (input.paperSubmitTo !== undefined) data.paperSubmitTo = trimmed(input.paperSubmitTo) || null;
  if (input.classes !== undefined) {
    data.classes = normalizeClasses(input.classes);
    data.classesCount = data.classes.length;
  }
  if (input.status !== undefined) {
    const status = trimmed(input.status);
    if (!EXAM_STATUSES.includes(status)) throw badRequest('Invalid status.');
    data.status = status;
  }
  if (input.notifyNote !== undefined) data.notifyNote = trimmed(input.notifyNote) || null;
  if (input.resultAnnounceDate !== undefined) {
    data.resultAnnounceDate = trimmed(input.resultAnnounceDate) || null;
  }
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw badRequest('End date cannot be before start date.');
  }

  const updated = await prisma.exam.update({ where: { id: existing.id }, data });
  return serializeExam(updated);
}

async function notifyExam(schoolId, id, input, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can send exam notices.');

  const existing = await prisma.exam.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Exam not found.');

  const notifyNote =
    input?.notifyNote !== undefined ? trimmed(input.notifyNote) || null : existing.notifyNote;
  const today = new Date().toISOString().slice(0, 10);

  const updated = await prisma.exam.update({
    where: { id: existing.id },
    data: {
      notifyNote,
      notifiedAt: today,
      status: existing.status === 'Draft' ? 'Notified' : existing.status,
    },
  });

  await notifyTeachersForExam(schoolId, updated, auth);
  return serializeExam(updated);
}

async function deleteExam(schoolId, id, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can delete exams.');
  const existing = await prisma.exam.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Exam not found.');
  await prisma.exam.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

async function listSlots(schoolId, { examId, branchId, cls } = {}) {
  const where = { schoolId };
  if (examId) where.examId = examId;
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (cls) where.cls = cls;

  const rows = await prisma.examPaperSlot.findMany({
    where,
    include: { exam: { select: { name: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map((r) => serializeSlot(r, r.exam?.name));
}

async function createSlot(schoolId, input, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can create paper timetable slots.');

  const examId = trimmed(input.examId);
  if (!examId) throw badRequest('Exam is required.');
  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');

  const cls = trimmed(input.cls);
  const subject = trimmed(input.subject);
  const date = trimmed(input.date);
  const startTime = trimmed(input.startTime);
  const endTime = trimmed(input.endTime);
  if (!cls) throw badRequest('Class is required.');
  if (!subject) throw badRequest('Subject is required.');
  if (!date) throw badRequest('Paper date is required.');
  if (!startTime || !endTime) throw badRequest('Start and end time are required.');

  const section = trimmed(input.section);
  const branchId =
    input.branchId && input.branchId !== 'all' ? input.branchId : exam.branchId || null;

  let teacherId = input.teacherId || null;
  let teacherName = trimmed(input.teacherName) || null;
  if (!teacherId || !teacherName) {
    const resolved = await findSubjectTeacher(schoolId, { cls, section, subject, branchId });
    teacherId = teacherId || resolved.teacherId;
    teacherName = teacherName || resolved.teacherName;
  }

  const row = await prisma.examPaperSlot.create({
    data: {
      schoolId,
      examId,
      branchId,
      cls,
      section,
      subject,
      subjectId: input.subjectId || null,
      date,
      startTime,
      endTime,
      room: trimmed(input.room) || null,
      invigilator: trimmed(input.invigilator) || null,
      teacherId,
      teacherName,
    },
  });

  await refreshExamClasses(schoolId, examId);

  // Once a timetable exists, move Draft/Notified → Scheduled.
  if (exam.status === 'Draft' || exam.status === 'Notified') {
    await prisma.exam.update({ where: { id: examId }, data: { status: 'Scheduled' } });
  }

  // Notify the assigned teacher about paper submission window.
  if (teacherName) {
    const submitTo = exam.paperSubmitTo || exam.startDate;
    const submitFrom = exam.paperSubmitFrom || '';
    await createNotice(schoolId, {
      title: `Question paper due: ${subject} · ${cls}`,
      content: [
        `Please prepare and submit the question paper for ${exam.name}.`,
        `Class: ${cls}${section ? `-${section}` : ''} · Subject: ${subject}`,
        `Paper date: ${date} (${startTime}–${endTime})`,
        submitFrom
          ? `Submit between ${submitFrom} and ${submitTo}.`
          : `Submit by ${submitTo}.`,
        'You can upload a PDF, Word file, or image from the Teacher portal → Exams.',
      ].join('\n'),
      audience: 'Teachers',
      channel: 'App',
      type: 'Exam',
      status: 'Published',
      author: auth?.name || 'Admin',
      authorId: auth?.userId || null,
      branchId,
      cls,
      section: section || null,
    });
  }

  return serializeSlot({ ...row, exam: { name: exam.name } }, exam.name);
}

async function updateSlot(schoolId, id, input, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can update paper timetable slots.');

  const existing = await prisma.examPaperSlot.findFirst({
    where: { schoolId, id },
    include: { exam: { select: { name: true } } },
  });
  if (!existing) throw notFound('Paper slot not found.');

  const data = {};
  if (input.cls !== undefined) data.cls = trimmed(input.cls);
  if (input.section !== undefined) data.section = trimmed(input.section);
  if (input.subject !== undefined) data.subject = trimmed(input.subject);
  if (input.subjectId !== undefined) data.subjectId = input.subjectId || null;
  if (input.date !== undefined) data.date = trimmed(input.date);
  if (input.startTime !== undefined) data.startTime = trimmed(input.startTime);
  if (input.endTime !== undefined) data.endTime = trimmed(input.endTime);
  if (input.room !== undefined) data.room = trimmed(input.room) || null;
  if (input.invigilator !== undefined) data.invigilator = trimmed(input.invigilator) || null;
  if (input.teacherId !== undefined) data.teacherId = input.teacherId || null;
  if (input.teacherName !== undefined) data.teacherName = trimmed(input.teacherName) || null;
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  // Re-resolve teacher if class/subject changed and teacher not explicitly set.
  if (
    (data.cls || data.subject || data.section !== undefined) &&
    input.teacherId === undefined &&
    input.teacherName === undefined
  ) {
    const resolved = await findSubjectTeacher(schoolId, {
      cls: data.cls || existing.cls,
      section: data.section !== undefined ? data.section : existing.section,
      subject: data.subject || existing.subject,
      branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
    });
    data.teacherId = resolved.teacherId;
    data.teacherName = resolved.teacherName;
  }

  const updated = await prisma.examPaperSlot.update({ where: { id: existing.id }, data });
  await refreshExamClasses(schoolId, existing.examId);
  return serializeSlot({ ...updated, exam: existing.exam }, existing.exam?.name);
}

async function deleteSlot(schoolId, id, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can delete paper timetable slots.');
  const existing = await prisma.examPaperSlot.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Paper slot not found.');
  await prisma.examPaperSlot.delete({ where: { id: existing.id } });
  await refreshExamClasses(schoolId, existing.examId);
  return { id: existing.id, deleted: true };
}

async function listSubmissions(schoolId, { examId, branchId, status } = {}) {
  const where = { schoolId };
  if (examId) where.examId = examId;
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status) where.status = status;

  const rows = await prisma.questionPaperSubmission.findMany({
    where,
    include: { exam: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeSubmission);
}

async function reviewSubmission(schoolId, id, input, auth) {
  if (!isAdminAuth(auth)) throw forbidden('Only admin can review question papers.');

  const existing = await prisma.questionPaperSubmission.findFirst({ where: { schoolId, id } });
  if (!existing) throw notFound('Question paper submission not found.');

  const status = trimmed(input.status);
  if (!['Approved', 'Rejected', 'Submitted'].includes(status)) {
    throw badRequest('Status must be Approved, Rejected, or Submitted.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const updated = await prisma.questionPaperSubmission.update({
    where: { id: existing.id },
    data: {
      status,
      note: input.note !== undefined ? trimmed(input.note) || null : existing.note,
      reviewedAt: today,
      reviewedBy: auth?.name || auth?.userId || 'Admin',
    },
    include: { exam: { select: { name: true } } },
  });
  return serializeSubmission(updated);
}

/**
 * Teacher view: paper duties derived from subject assignments + exam slots.
 */
async function listMyPaperTasks(schoolId, auth) {
  if (!isTeacherAuth(auth) && !isAdminAuth(auth)) {
    throw forbidden('Only teachers can view paper tasks.');
  }

  const user = await resolveUser(schoolId, auth);
  const employee = await resolveEmployeeForUser(schoolId, auth);
  const teacherName = employee?.name || user?.name || '';
  const teacherId = employee?.id || null;

  const assignmentWhere = { schoolId, status: 'Active' };
  if (teacherId) {
    assignmentWhere.OR = [
      { teacherId },
      ...(teacherName
        ? [{ teacherName: { equals: teacherName, mode: 'insensitive' } }]
        : []),
    ];
  } else if (teacherName) {
    assignmentWhere.teacherName = { equals: teacherName, mode: 'insensitive' };
  } else {
    return { tasks: [], exams: [] };
  }

  const assignments = await prisma.subjectAssignment.findMany({ where: assignmentWhere });
  if (!assignments.length) return { tasks: [], exams: [] };

  const assignmentKeys = assignments.map((a) => ({
    cls: a.className,
    section: a.section || '',
    subject: a.subjectName,
    teacherId: a.teacherId,
    teacherName: a.teacherName,
  }));

  const slotOr = assignmentKeys.flatMap((a) => [
    {
      cls: { equals: a.cls, mode: 'insensitive' },
      subject: { equals: a.subject, mode: 'insensitive' },
      OR: [
        { section: '' },
        { section: { equals: a.section, mode: 'insensitive' } },
      ],
    },
  ]);

  const slots = await prisma.examPaperSlot.findMany({
    where: {
      schoolId,
      OR: [
        ...(teacherId ? [{ teacherId }] : []),
        ...(teacherName
          ? [{ teacherName: { equals: teacherName, mode: 'insensitive' } }]
          : []),
        ...(slotOr.length ? slotOr : [{ id: '__none__' }]),
      ],
    },
    include: {
      exam: true,
      submissions: {
        where: {
          OR: [
            ...(teacherId ? [{ teacherId }, { employeeId: teacherId }] : []),
            ...(teacherName
              ? [{ teacherName: { equals: teacherName, mode: 'insensitive' } }]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  const today = new Date().toISOString().slice(0, 10);
  const tasks = slots.map((slot) => {
    const exam = slot.exam;
    const submission = slot.submissions[0] || null;
    const submitFrom = exam.paperSubmitFrom || '';
    const submitTo = exam.paperSubmitTo || exam.startDate;
    let paperStatus = 'Pending';
    if (submission) paperStatus = submission.status;
    else if (submitTo && today > submitTo) paperStatus = 'Overdue';
    else if (submitFrom && today < submitFrom) paperStatus = 'Upcoming';

    return {
      id: slot.id,
      slotId: slot.id,
      examId: exam.id,
      exam: exam.name,
      examType: exam.type,
      examStatus: exam.status,
      session: exam.session,
      cls: slot.cls,
      section: slot.section || '',
      subject: slot.subject,
      paperDate: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || '',
      invigilator: slot.invigilator || '',
      paperSubmitFrom: submitFrom,
      paperSubmitTo: submitTo,
      paperStatus,
      submission: submission ? serializeSubmission({ ...submission, exam }) : null,
    };
  });

  const examMap = new Map();
  for (const t of tasks) {
    if (!examMap.has(t.examId)) {
      examMap.set(t.examId, {
        id: t.examId,
        name: t.exam,
        type: t.examType,
        session: t.session,
        status: t.examStatus,
        paperSubmitFrom: t.paperSubmitFrom,
        paperSubmitTo: t.paperSubmitTo,
        pending: 0,
        submitted: 0,
      });
    }
    const e = examMap.get(t.examId);
    if (t.paperStatus === 'Submitted' || t.paperStatus === 'Approved') e.submitted += 1;
    else e.pending += 1;
  }

  return { tasks, exams: [...examMap.values()] };
}

async function submitQuestionPaper(schoolId, input, auth) {
  if (!isTeacherAuth(auth) && !isAdminAuth(auth)) {
    throw forbidden('Only teachers can submit question papers.');
  }

  const user = await resolveUser(schoolId, auth);
  const employee = await resolveEmployeeForUser(schoolId, auth);
  const teacherName = trimmed(input.teacherName) || employee?.name || user?.name || 'Teacher';
  const teacherId = employee?.id || input.teacherId || null;

  const examId = trimmed(input.examId);
  const slotId = trimmed(input.slotId) || null;
  if (!examId) throw badRequest('Exam is required.');

  const exam = await prisma.exam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw notFound('Exam not found.');

  let slot = null;
  if (slotId) {
    slot = await prisma.examPaperSlot.findFirst({ where: { schoolId, id: slotId, examId } });
    if (!slot) throw notFound('Paper slot not found.');
  }

  const cls = trimmed(input.cls) || slot?.cls;
  const subject = trimmed(input.subject) || slot?.subject;
  const section = trimmed(input.section) || slot?.section || '';
  if (!cls || !subject) throw badRequest('Class and subject are required.');

  const { normalizeCloudAttachments } = require('../../utils/attachments');
  const files = normalizeCloudAttachments(input.files || input.attachments, {
    required: true,
    label: 'question paper file',
  });

  const today = new Date().toISOString().slice(0, 10);
  const submitFrom = exam.paperSubmitFrom;
  const submitTo = exam.paperSubmitTo || exam.startDate;
  if (submitFrom && today < submitFrom) {
    throw badRequest(`Paper submission opens on ${submitFrom}.`);
  }
  if (submitTo && today > submitTo && !isAdminAuth(auth)) {
    throw badRequest(`Paper submission closed on ${submitTo}.`);
  }

  const existing = slotId
    ? await prisma.questionPaperSubmission.findFirst({
        where: {
          schoolId,
          examId,
          slotId,
          OR: [
            ...(teacherId ? [{ teacherId }, { employeeId: teacherId }] : []),
            { teacherName: { equals: teacherName, mode: 'insensitive' } },
          ],
        },
      })
    : await prisma.questionPaperSubmission.findFirst({
        where: {
          schoolId,
          examId,
          cls: { equals: cls, mode: 'insensitive' },
          subject: { equals: subject, mode: 'insensitive' },
          OR: [
            ...(teacherId ? [{ teacherId }, { employeeId: teacherId }] : []),
            { teacherName: { equals: teacherName, mode: 'insensitive' } },
          ],
        },
      });

  const payload = {
    schoolId,
    examId,
    slotId: slotId || null,
    branchId: slot?.branchId || exam.branchId || null,
    cls,
    section,
    subject,
    teacherId,
    teacherName,
    employeeId: employee?.id || null,
    status: 'Submitted',
    note: trimmed(input.note) || null,
    files,
    submittedAt: today,
    reviewedAt: null,
    reviewedBy: null,
  };

  let row;
  if (existing) {
    row = await prisma.questionPaperSubmission.update({
      where: { id: existing.id },
      data: payload,
      include: { exam: { select: { name: true } } },
    });
  } else {
    row = await prisma.questionPaperSubmission.create({
      data: payload,
      include: { exam: { select: { name: true } } },
    });
  }

  // Notify admin that a paper arrived.
  await createNotice(schoolId, {
    title: `Question paper received: ${subject} · ${cls}`,
    content: [
      `${teacherName} submitted the question paper for ${exam.name}.`,
      `Class: ${cls}${section ? `-${section}` : ''} · Subject: ${subject}`,
      `${files.length} file(s) attached.`,
      trimmed(input.note) || '',
    ]
      .filter(Boolean)
      .join('\n'),
    audience: 'Admin',
    channel: 'App',
    type: 'Exam',
    status: 'Published',
    author: teacherName,
    authorId: auth?.userId || null,
    branchId: payload.branchId,
    cls,
    section: section || null,
  });

  return serializeSubmission(row);
}

module.exports = {
  listExams,
  getExam,
  createExam,
  updateExam,
  notifyExam,
  deleteExam,
  listSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  listSubmissions,
  reviewSubmission,
  listMyPaperTasks,
  submitQuestionPaper,
};
