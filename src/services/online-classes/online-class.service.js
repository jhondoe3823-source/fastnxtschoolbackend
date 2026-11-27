/**
 * Online Classes — Google Meet-backed academic sessions.
 */

const { prisma } = require('../../config/database');
const { badRequest, notFound, forbidden } = require('../../utils/errors');
const googleOAuth = require('../integrations/google-oauth.service');
const googleMeet = require('../integrations/google-meet.service');
const { createNotification } = require('../notifications/notification.service');
const logger = require('../../utils/logger');

const STATUSES = new Set(['Scheduled', 'Live', 'Completed', 'Cancelled']);
const trimmed = (v) => String(v ?? '').trim();

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseStudentIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

function endAt(scheduledAt, durationMinutes) {
  return new Date(scheduledAt.getTime() + durationMinutes * 60_000);
}

function deriveStatus(row, now = new Date()) {
  if (row.status === 'Cancelled' || row.status === 'Completed') return row.status;
  const start = new Date(row.scheduledAt);
  const finish = endAt(start, row.durationMinutes || 45);
  if (now < start) return 'Scheduled';
  if (now >= start && now <= finish) return 'Live';
  return row.status === 'Live' ? 'Live' : 'Completed';
}

function serialize(row) {
  if (!row) return null;
  const status = deriveStatus(row);
  return {
    id: row.id,
    schoolId: row.schoolId,
    branchId: row.branchId || null,
    teacherUserId: row.teacherUserId,
    teacherName: row.teacherName || '',
    teacherEmployeeId: row.teacherEmployeeId || null,
    cls: row.cls,
    section: row.section,
    subjectId: row.subjectId || null,
    subjectName: row.subjectName || '',
    title: row.title,
    description: row.description || '',
    scheduledAt: row.scheduledAt instanceof Date ? row.scheduledAt.toISOString() : row.scheduledAt,
    durationMinutes: row.durationMinutes,
    timezone: row.timezone || 'Asia/Karachi',
    endsAt: endAt(new Date(row.scheduledAt), row.durationMinutes).toISOString(),
    meetingSpaceName: row.meetingSpaceName || null,
    meetingUrl: row.meetingUrl || null,
    meetingCode: row.meetingCode || null,
    conferenceRecordName: row.conferenceRecordName || null,
    status,
    studentIds: parseStudentIds(row.studentIds),
    cancelReason: row.cancelReason || null,
    googleIntegrationId: row.googleIntegrationId || null,
    createdById: row.createdById || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isAdminLike(auth) {
  const role = String(auth.role || '').toLowerCase();
  return (
    auth.panel === 'admin' &&
    (role.includes('admin') || role.includes('owner') || role.includes('principal') || role === 'account')
  );
}

async function resolveTeacherContext(schoolId, auth) {
  const user = await prisma.user.findFirst({
    where: { id: auth.userId, schoolId },
    select: { id: true, name: true, email: true, role: true, panel: true },
  });
  if (!user) throw forbidden('User not found for this school.');

  let employee = null;
  if (user.email) {
    employee = await prisma.employee.findFirst({
      where: { schoolId, email: { equals: user.email, mode: 'insensitive' } },
    });
  }
  if (!employee && user.name) {
    employee = await prisma.employee.findFirst({
      where: { schoolId, name: { equals: user.name, mode: 'insensitive' } },
    });
  }

  return {
    user,
    teacherUserId: user.id,
    teacherName: user.name,
    teacherEmployeeId: employee?.id || null,
  };
}

async function listEligibleStudents(schoolId, { cls, section, studentIds, branchId }) {
  const where = {
    schoolId,
    status: 'Active',
    cls,
    section,
  };
  if (branchId && branchId !== 'all') {
    where.OR = [{ branchId }, { branchId: null }];
  }
  if (studentIds?.length) {
    where.id = { in: studentIds };
  }
  return prisma.student.findMany({
    where,
    select: {
      id: true,
      name: true,
      studentId: true,
      email: true,
      cls: true,
      section: true,
      branchId: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function notifyStudents(schoolId, students, { title, message, href }) {
  for (const st of students) {
    if (!st.email) continue;
    const user = await prisma.user.findFirst({
      where: { schoolId, email: { equals: st.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) continue;
    try {
      await createNotification({
        schoolId,
        userId: user.id,
        title,
        message,
        icon: 'calendar',
        tone: 'blue',
        href,
      });
    } catch (err) {
      logger.warn(`Online class notify failed for ${st.email}: ${err.message}`);
    }
  }
}

async function dashboard(schoolId, auth, { branchId } = {}) {
  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (auth.panel === 'teacher') where.teacherUserId = auth.userId;

  const rows = await prisma.onlineClass.findMany({ where, orderBy: { scheduledAt: 'desc' } });
  const serialized = rows.map(serialize);
  const now = Date.now();
  const upcoming = serialized.filter((r) => r.status === 'Scheduled').length;
  const live = serialized.filter((r) => r.status === 'Live').length;
  const completed = serialized.filter((r) => r.status === 'Completed').length;
  const cancelled = serialized.filter((r) => r.status === 'Cancelled').length;

  const participantStats = await prisma.onlineClassParticipant.groupBy({
    by: ['attendanceStatus'],
    where: { schoolId, onlineClassId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const present = participantStats
    .filter((g) => g.attendanceStatus === 'Present' || g.attendanceStatus === 'Late')
    .reduce((a, g) => a + g._count._all, 0);
  const totalMarked = participantStats.reduce((a, g) => a + g._count._all, 0);

  return {
    summary: {
      total: serialized.length,
      upcoming,
      live,
      completed,
      cancelled,
      attendanceRate: totalMarked ? Math.round((present / totalMarked) * 100) : 0,
    },
    recent: serialized.slice(0, 8),
    asOf: new Date(now).toISOString(),
  };
}

async function listClasses(schoolId, auth, query = {}) {
  const where = { schoolId };
  if (query.branchId && query.branchId !== 'all') where.branchId = query.branchId;
  if (query.cls) where.cls = trimmed(query.cls);
  if (query.section) where.section = trimmed(query.section);
  if (query.subjectId) where.subjectId = trimmed(query.subjectId);
  if (query.teacherUserId) where.teacherUserId = trimmed(query.teacherUserId);
  if (query.status && STATUSES.has(query.status)) where.status = query.status;
  if (query.from || query.to) {
    where.scheduledAt = {};
    if (query.from) where.scheduledAt.gte = new Date(query.from);
    if (query.to) where.scheduledAt.lte = new Date(query.to);
  }

  if (auth.panel === 'teacher') {
    where.teacherUserId = auth.userId;
  }

  if (auth.panel === 'student') {
    const student = await resolveStudent(schoolId, auth);
    where.cls = student.cls;
    where.section = student.section;
    where.status = { not: 'Cancelled' };
  }

  const rows = await prisma.onlineClass.findMany({
    where,
    orderBy: { scheduledAt: query.sort === 'asc' ? 'asc' : 'desc' },
    take: Math.min(toInt(query.limit, 200), 500),
  });

  let list = rows.map(serialize);

  if (auth.panel === 'student') {
    const student = await resolveStudent(schoolId, auth);
    list = list.filter((r) => {
      if (!r.studentIds.length) return true;
      return r.studentIds.includes(student.id);
    });
  }

  if (query.bucket === 'upcoming') list = list.filter((r) => r.status === 'Scheduled');
  if (query.bucket === 'live') list = list.filter((r) => r.status === 'Live');
  if (query.bucket === 'completed') list = list.filter((r) => r.status === 'Completed');
  if (query.bucket === 'history') list = list.filter((r) => r.status === 'Completed' || r.status === 'Cancelled');

  // Soft-update Live/Completed labels without writing every list call unless drifted.
  return { classes: list };
}

async function resolveStudent(schoolId, auth) {
  const user = await prisma.user.findFirst({ where: { id: auth.userId, schoolId } });
  if (!user) throw forbidden('Student user not found.');
  let student = null;
  if (user.email) {
    student = await prisma.student.findFirst({
      where: { schoolId, email: { equals: user.email, mode: 'insensitive' } },
    });
  }
  if (!student) {
    student = await prisma.student.findFirst({
      where: { schoolId, name: { equals: user.name, mode: 'insensitive' } },
    });
  }
  if (!student) throw forbidden('No student record is linked to this login.');
  return student;
}

async function getClass(schoolId, auth, id) {
  const row = await prisma.onlineClass.findFirst({ where: { id, schoolId } });
  if (!row) throw notFound('Online class not found.');

  if (auth.panel === 'teacher' && row.teacherUserId !== auth.userId && !isAdminLike(auth)) {
    throw forbidden('You can only view your own online classes.');
  }
  if (auth.panel === 'student') {
    const student = await resolveStudent(schoolId, auth);
    const ids = parseStudentIds(row.studentIds);
    if (row.cls !== student.cls || row.section !== student.section) {
      throw forbidden('This online class is not for your section.');
    }
    if (ids.length && !ids.includes(student.id)) {
      throw forbidden('You are not enrolled in this online class.');
    }
  }

  const participants = await prisma.onlineClassParticipant.findMany({
    where: { onlineClassId: row.id },
    orderBy: { studentName: 'asc' },
  });

  return {
    class: serialize(row),
    participants: participants.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.studentName,
      studentCode: p.studentCode,
      attendanceStatus: p.attendanceStatus,
      attendedMinutes: p.attendedMinutes,
      joinTime: p.joinTime,
      leaveTime: p.leaveTime,
      joinAttempts: p.joinAttempts,
      lastJoinAt: p.lastJoinAt,
      manuallyVerified: p.manuallyVerified,
      matchedBy: p.matchedBy,
      googleDisplayName: p.googleDisplayName,
    })),
  };
}

async function createClass(schoolId, auth, input) {
  if (auth.panel === 'student') throw forbidden('Students cannot create online classes.');

  const teacherCtx = await resolveTeacherContext(schoolId, auth);
  const teacherUserId = isAdminLike(auth) && input.teacherUserId
    ? trimmed(input.teacherUserId)
    : teacherCtx.teacherUserId;
  const teacherName = teacherUserId === teacherCtx.teacherUserId
    ? teacherCtx.teacherName
    : trimmed(input.teacherName) || teacherCtx.teacherName;

  const cls = trimmed(input.cls);
  const section = trimmed(input.section) || 'A';
  const title = trimmed(input.title);
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const durationMinutes = Math.max(15, toInt(input.durationMinutes, 45));

  if (!cls) throw badRequest('Class / Course is required.');
  if (!title) throw badRequest('Class title is required.');
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    throw badRequest('Valid scheduled date/time is required.');
  }

  const studentIds = parseStudentIds(input.studentIds);
  const students = await listEligibleStudents(schoolId, {
    cls,
    section,
    studentIds: studentIds.length ? studentIds : undefined,
    branchId: input.branchId,
  });

  const hostUserId = teacherUserId;
  const { accessToken, integration } = await googleOAuth.getValidAccessToken(schoolId, hostUserId);
  const space = await googleMeet.createSpace(accessToken, { title });
  if (!space.meetingUrl) {
    throw badRequest('Google Meet did not return a meeting URL. Check Meet API access for this Google account.');
  }

  const row = await prisma.onlineClass.create({
    data: {
      schoolId,
      branchId: input.branchId && input.branchId !== 'all' ? input.branchId : null,
      teacherUserId: hostUserId,
      teacherName,
      teacherEmployeeId: teacherCtx.teacherEmployeeId,
      cls,
      section,
      subjectId: trimmed(input.subjectId) || null,
      subjectName: trimmed(input.subjectName) || '',
      title,
      description: trimmed(input.description) || '',
      scheduledAt,
      durationMinutes,
      timezone: trimmed(input.timezone) || 'Asia/Karachi',
      meetingSpaceName: space.meetingSpaceName,
      meetingUrl: space.meetingUrl,
      meetingCode: space.meetingCode,
      status: 'Scheduled',
      studentIds: studentIds.length ? studentIds : [],
      googleIntegrationId: integration.id,
      createdById: auth.userId,
    },
  });

  if (students.length) {
    await prisma.onlineClassParticipant.createMany({
      data: students.map((s) => ({
        schoolId,
        onlineClassId: row.id,
        studentId: s.id,
        studentName: s.name,
        studentCode: s.studentId || null,
        attendanceStatus: 'Pending Verification',
      })),
      skipDuplicates: true,
    });
  }

  await notifyStudents(schoolId, students, {
    title: 'New online class scheduled',
    message: `${title} · ${cls}-${section} on ${scheduledAt.toISOString()}`,
    href: '/student/online-classes',
  });

  if (hostUserId !== auth.userId) {
    try {
      await createNotification({
        schoolId,
        userId: hostUserId,
        title: 'Online class assigned to you',
        message: `${title} · ${cls}-${section} on ${scheduledAt.toISOString()}`,
        icon: 'calendar',
        tone: 'blue',
        href: '/teacher/online-classes',
      });
    } catch (err) {
      logger.warn(`Teacher notify failed: ${err.message}`);
    }
  }

  return serialize(row);
}

async function updateClass(schoolId, auth, id, input) {
  const existing = await prisma.onlineClass.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Online class not found.');
  if (auth.panel === 'teacher' && existing.teacherUserId !== auth.userId && !isAdminLike(auth)) {
    throw forbidden('You can only edit your own online classes.');
  }
  if (existing.status === 'Cancelled') throw badRequest('Cancelled classes cannot be edited.');

  const data = {};
  if (input.title !== undefined) data.title = trimmed(input.title);
  if (input.description !== undefined) data.description = trimmed(input.description);
  if (input.cls !== undefined) data.cls = trimmed(input.cls);
  if (input.section !== undefined) data.section = trimmed(input.section);
  if (input.subjectId !== undefined) data.subjectId = trimmed(input.subjectId) || null;
  if (input.subjectName !== undefined) data.subjectName = trimmed(input.subjectName);
  if (input.durationMinutes !== undefined) data.durationMinutes = Math.max(15, toInt(input.durationMinutes, 45));
  if (input.timezone !== undefined) data.timezone = trimmed(input.timezone) || existing.timezone;
  if (input.studentIds !== undefined) data.studentIds = parseStudentIds(input.studentIds);
  if (input.scheduledAt !== undefined) {
    const next = new Date(input.scheduledAt);
    if (Number.isNaN(next.getTime())) throw badRequest('Invalid scheduledAt.');
    data.scheduledAt = next;
  }
  if (input.status !== undefined) {
    if (!STATUSES.has(input.status)) throw badRequest('Invalid status.');
    data.status = input.status;
  }

  // Never recreate Meet space on edit/reschedule — keep existing meetingUrl.
  const updated = await prisma.onlineClass.update({ where: { id: existing.id }, data });

  if (data.scheduledAt) {
    const students = await listEligibleStudents(schoolId, {
      cls: updated.cls,
      section: updated.section,
      studentIds: parseStudentIds(updated.studentIds).length
        ? parseStudentIds(updated.studentIds)
        : undefined,
      branchId: updated.branchId,
    });
    await notifyStudents(schoolId, students, {
      title: 'Online class rescheduled',
      message: `${updated.title} moved to ${updated.scheduledAt.toISOString()}`,
      href: '/student/online-classes',
    });
  }

  return serialize(updated);
}

async function cancelClass(schoolId, auth, id, reason) {
  const existing = await prisma.onlineClass.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Online class not found.');
  if (auth.panel === 'teacher' && existing.teacherUserId !== auth.userId && !isAdminLike(auth)) {
    throw forbidden('You can only cancel your own online classes.');
  }
  const updated = await prisma.onlineClass.update({
    where: { id: existing.id },
    data: { status: 'Cancelled', cancelReason: trimmed(reason) || null },
  });

  const students = await listEligibleStudents(schoolId, {
    cls: existing.cls,
    section: existing.section,
    studentIds: parseStudentIds(existing.studentIds).length
      ? parseStudentIds(existing.studentIds)
      : undefined,
    branchId: existing.branchId,
  });
  await notifyStudents(schoolId, students, {
    title: 'Online class cancelled',
    message: `${existing.title} (${existing.cls}-${existing.section}) was cancelled.`,
    href: '/student/online-classes',
  });

  return serialize(updated);
}

async function deleteClass(schoolId, auth, id) {
  const existing = await prisma.onlineClass.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Online class not found.');
  if (!isAdminLike(auth) && !(auth.panel === 'teacher' && existing.teacherUserId === auth.userId)) {
    throw forbidden('Not allowed to delete this online class.');
  }
  if (existing.status === 'Live') {
    throw badRequest('Complete or cancel a live class before deleting.');
  }
  await prisma.onlineClass.delete({ where: { id: existing.id } });
  return { deleted: true, id };
}

async function joinClass(schoolId, auth, id) {
  const existing = await prisma.onlineClass.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound('Online class not found.');
  if (existing.status === 'Cancelled') throw badRequest('This class was cancelled.');
  if (!existing.meetingUrl) throw badRequest('Meeting URL is not available.');

  const now = new Date();
  const start = new Date(existing.scheduledAt);
  const earlyMs = 15 * 60_000;
  if (now.getTime() + earlyMs < start.getTime()) {
    throw badRequest('This class has not started yet. Join opens 15 minutes before the scheduled time.');
  }

  if (auth.panel === 'student') {
    const student = await resolveStudent(schoolId, auth);
    const ids = parseStudentIds(existing.studentIds);
    if (existing.cls !== student.cls || existing.section !== student.section) {
      throw forbidden('This online class is not for your section.');
    }
    if (ids.length && !ids.includes(student.id)) {
      throw forbidden('You are not enrolled in this online class.');
    }

    const participant = await prisma.onlineClassParticipant.findFirst({
      where: { onlineClassId: existing.id, studentId: student.id },
    });
    if (participant) {
      await prisma.onlineClassParticipant.update({
        where: { id: participant.id },
        data: {
          joinAttempts: { increment: 1 },
          lastJoinAt: now,
          attendanceStatus:
            participant.manuallyVerified || participant.attendanceStatus === 'Present'
              ? participant.attendanceStatus
              : 'Joined',
        },
      });
    } else {
      await prisma.onlineClassParticipant.create({
        data: {
          schoolId,
          onlineClassId: existing.id,
          studentId: student.id,
          studentName: student.name,
          studentCode: student.studentId || null,
          joinAttempts: 1,
          lastJoinAt: now,
          attendanceStatus: 'Joined',
        },
      });
    }
  }

  if (existing.status === 'Scheduled') {
    await prisma.onlineClass.update({
      where: { id: existing.id },
      data: { status: 'Live' },
    });
  }

  return {
    meetingUrl: existing.meetingUrl,
    class: serialize({ ...existing, status: existing.status === 'Scheduled' ? 'Live' : existing.status }),
  };
}

/** Notify enrolled students for classes starting within the next `withinMinutes`. */
async function notifyStartingSoon(schoolId, { withinMinutes = 15 } = {}) {
  const now = Date.now();
  const until = new Date(now + withinMinutes * 60_000);
  const rows = await prisma.onlineClass.findMany({
    where: {
      schoolId,
      status: 'Scheduled',
      scheduledAt: { gte: new Date(now), lte: until },
    },
    take: 50,
  });

  let notified = 0;
  for (const row of rows) {
    const students = await listEligibleStudents(schoolId, {
      cls: row.cls,
      section: row.section,
      studentIds: parseStudentIds(row.studentIds).length
        ? parseStudentIds(row.studentIds)
        : undefined,
      branchId: row.branchId,
    });
    await notifyStudents(schoolId, students, {
      title: 'Online class starting soon',
      message: `${row.title} begins at ${row.scheduledAt.toISOString()}`,
      href: '/student/online-classes',
    });
    try {
      await createNotification({
        schoolId,
        userId: row.teacherUserId,
        title: 'Your online class starts soon',
        message: `${row.title} · ${row.cls}-${row.section}`,
        icon: 'calendar',
        tone: 'blue',
        href: '/teacher/online-classes',
      });
    } catch {
      /* ignore */
    }
    notified += 1;
  }
  return { notified };
}

module.exports = {
  dashboard,
  listClasses,
  getClass,
  createClass,
  updateClass,
  cancelClass,
  deleteClass,
  joinClass,
  listEligibleStudents,
  serialize,
  resolveStudent,
  isAdminLike,
  notifyStartingSoon,
};
