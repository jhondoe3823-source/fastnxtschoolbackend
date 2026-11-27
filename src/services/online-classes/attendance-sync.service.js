/**
 * Sync Google Meet conference participants → OnlineClassParticipant + StudentAttendance.
 *
 * Matching strategy (in order):
 * 1) Exact case-insensitive name match to enrolled students
 * 2) Student email equals Google display email when available
 * Otherwise leave Pending Verification — never invent Present marks.
 *
 * Does not overwrite manuallyVerified participant rows.
 */

const { prisma } = require('../../config/database');
const { badRequest, notFound, forbidden } = require('../../utils/errors');
const googleOAuth = require('../integrations/google-oauth.service');
const googleMeet = require('../integrations/google-meet.service');
const onlineClassService = require('./online-class.service');
const logger = require('../../utils/logger');

const DEFAULTS = {
  presentRatio: 0.75,
  lateGraceMinutes: 10,
};

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function classifyAttendance({ attendedMinutes, durationMinutes, joinTime, scheduledAt, rules }) {
  const required = Math.ceil(durationMinutes * rules.presentRatio);
  if (attendedMinutes <= 0) return 'Absent';
  if (attendedMinutes < required) return 'Partial';
  if (joinTime && scheduledAt) {
    const lateAfter = new Date(scheduledAt).getTime() + rules.lateGraceMinutes * 60_000;
    if (new Date(joinTime).getTime() > lateAfter) return 'Late';
  }
  return 'Present';
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function syncClassAttendance(schoolId, auth, onlineClassId, { force = false } = {}) {
  const row = await prisma.onlineClass.findFirst({ where: { id: onlineClassId, schoolId } });
  if (!row) throw notFound('Online class not found.');

  if (
    auth.panel === 'teacher' &&
    row.teacherUserId !== auth.userId &&
    !onlineClassService.isAdminLike(auth)
  ) {
    throw forbidden('You can only sync attendance for your own classes.');
  }
  if (!row.meetingSpaceName) {
    throw badRequest('This class has no Google Meet space to sync.');
  }

  const syncLog = await prisma.onlineClassAttendanceSync.create({
    data: {
      schoolId,
      onlineClassId: row.id,
      syncStatus: 'Running',
    },
  });

  try {
    const { accessToken } = await googleOAuth.getValidAccessToken(schoolId, row.teacherUserId);
    const records = await googleMeet.listConferenceRecords(accessToken, row.meetingSpaceName);
    if (!records.length) {
      await prisma.onlineClassAttendanceSync.update({
        where: { id: syncLog.id },
        data: {
          syncStatus: 'Partial',
          lastSyncedAt: new Date(),
          recordsProcessed: 0,
          errorMessage:
            'No conference records yet. Records appear after at least one participant joins the Meet.',
        },
      });
      return {
        sync: await prisma.onlineClassAttendanceSync.findUnique({ where: { id: syncLog.id } }),
        matched: 0,
        unmatched: [],
      };
    }

    // Prefer the latest conference for this space.
    const conference = [...records].sort((a, b) => {
      const ta = new Date(a.startTime || 0).getTime();
      const tb = new Date(b.startTime || 0).getTime();
      return tb - ta;
    })[0];

    const conferenceRecordName = conference.name;
    const participants = await googleMeet.listParticipants(accessToken, conferenceRecordName);

    const enrolled = await prisma.onlineClassParticipant.findMany({
      where: { onlineClassId: row.id, studentId: { not: null } },
    });
    const students = await prisma.student.findMany({
      where: { schoolId, id: { in: enrolled.map((e) => e.studentId).filter(Boolean) } },
      select: { id: true, name: true, email: true, studentId: true },
    });
    const byName = new Map(students.map((s) => [normalizeName(s.name), s]));
    const byEmail = new Map(
      students.filter((s) => s.email).map((s) => [String(s.email).toLowerCase(), s])
    );

    const rules = { ...DEFAULTS };
    let processed = 0;
    const unmatched = [];

    for (const p of participants) {
      const displayName =
        p.signedinUser?.displayName ||
        p.anonymousUser?.displayName ||
        p.phoneUser?.displayName ||
        '';
      const googleUser = p.signedinUser?.user || null;

      let sessions = [];
      try {
        if (p.name) sessions = await googleMeet.listParticipantSessions(accessToken, p.name);
      } catch (err) {
        logger.warn(`participantSessions failed for ${p.name}: ${err.message}`);
      }

      let joinTime = p.earliestStartTime ? new Date(p.earliestStartTime) : null;
      let leaveTime = p.latestEndTime ? new Date(p.latestEndTime) : null;
      let attendedMinutes = minutesBetween(joinTime, leaveTime);
      if (sessions.length) {
        attendedMinutes = sessions.reduce((sum, s) => {
          return sum + minutesBetween(s.startTime, s.endTime || leaveTime || new Date());
        }, 0);
        const starts = sessions.map((s) => s.startTime).filter(Boolean).map((t) => new Date(t));
        const ends = sessions.map((s) => s.endTime).filter(Boolean).map((t) => new Date(t));
        if (starts.length) joinTime = new Date(Math.min(...starts.map((d) => d.getTime())));
        if (ends.length) leaveTime = new Date(Math.max(...ends.map((d) => d.getTime())));
      }

      let student = byName.get(normalizeName(displayName)) || null;
      let matchedBy = student ? 'name' : null;
      if (!student && displayName.includes('@')) {
        student = byEmail.get(displayName.toLowerCase()) || null;
        if (student) matchedBy = 'email';
      }

      if (!student) {
        unmatched.push({
          googleParticipantName: p.name || null,
          googleDisplayName: displayName,
          googleUser,
          attendedMinutes,
        });
        continue;
      }

      const existing = enrolled.find((e) => e.studentId === student.id);
      if (existing?.manuallyVerified && !force) {
        processed += 1;
        continue;
      }

      const attendanceStatus = classifyAttendance({
        attendedMinutes,
        durationMinutes: row.durationMinutes,
        joinTime,
        scheduledAt: row.scheduledAt,
        rules,
      });

      await prisma.onlineClassParticipant.upsert({
        where: {
          onlineClassId_studentId: { onlineClassId: row.id, studentId: student.id },
        },
        create: {
          schoolId,
          onlineClassId: row.id,
          studentId: student.id,
          studentName: student.name,
          studentCode: student.studentId || null,
          googleParticipantName: p.name || null,
          googleParticipantIdentifier: googleUser,
          googleDisplayName: displayName,
          joinTime,
          leaveTime,
          attendedMinutes,
          attendanceStatus,
          matchedBy,
        },
        update: {
          googleParticipantName: p.name || null,
          googleParticipantIdentifier: googleUser,
          googleDisplayName: displayName,
          joinTime,
          leaveTime,
          attendedMinutes,
          attendanceStatus,
          matchedBy,
        },
      });

      // Mirror into daily StudentAttendance only for definitive Present/Late/Absent/Partial.
      // Partial maps to Late with remark; Pending Verification is skipped.
      if (attendanceStatus !== 'Pending Verification' && attendanceStatus !== 'Joined') {
        const date = row.scheduledAt.toISOString().slice(0, 10);
        const status =
          attendanceStatus === 'Partial'
            ? 'Late'
            : attendanceStatus === 'Late'
              ? 'Late'
              : attendanceStatus === 'Present'
                ? 'Present'
                : 'Absent';
        const existingAtt = await prisma.studentAttendance.findUnique({
          where: {
            schoolId_studentId_date: {
              schoolId,
              studentId: student.id,
              date,
            },
          },
        });
        // Do not overwrite if staff already marked and left a non-online remark without force.
        const onlineRemark = `Online class ${row.title} (${attendedMinutes} min)`;
        if (existingAtt && existingAtt.remark && !String(existingAtt.remark).startsWith('Online class') && !force) {
          processed += 1;
          continue;
        }
        await prisma.studentAttendance.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId,
              studentId: student.id,
              date,
            },
          },
          create: {
            schoolId,
            branchId: row.branchId || null,
            studentId: student.id,
            studentName: student.name,
            studentCode: student.studentId || null,
            cls: row.cls,
            section: row.section,
            date,
            status,
            remark: onlineRemark,
            markedById: auth.userId,
            markedBy: 'Google Meet Sync',
          },
          update: {
            status,
            remark: onlineRemark,
            markedById: auth.userId,
            markedBy: 'Google Meet Sync',
          },
        });
      }

      processed += 1;
    }

    // Students with no Google match → Absent only after class should have ended.
    const ended = Date.now() > row.scheduledAt.getTime() + row.durationMinutes * 60_000;
    if (ended) {
      for (const e of enrolled) {
        const stillPending =
          !e.manuallyVerified &&
          (!e.googleParticipantName || e.attendanceStatus === 'Pending Verification' || e.attendanceStatus === 'Joined');
        if (!stillPending) continue;
        const wasMatched = participants.some((p) => {
          const dn = normalizeName(
            p.signedinUser?.displayName || p.anonymousUser?.displayName || ''
          );
          return dn && dn === normalizeName(e.studentName);
        });
        if (wasMatched) continue;
        await prisma.onlineClassParticipant.update({
          where: { id: e.id },
          data: { attendanceStatus: 'Absent', attendedMinutes: 0 },
        });
      }
    }

    await prisma.onlineClass.update({
      where: { id: row.id },
      data: {
        conferenceRecordName,
        status: ended ? 'Completed' : row.status === 'Scheduled' ? 'Live' : row.status,
      },
    });

    await prisma.onlineClassAttendanceSync.update({
      where: { id: syncLog.id },
      data: {
        syncStatus: unmatched.length ? 'Partial' : 'Success',
        lastSyncedAt: new Date(),
        recordsProcessed: processed,
        errorMessage: unmatched.length
          ? `${unmatched.length} Google participant(s) could not be matched to students.`
          : null,
        details: { unmatched, conferenceRecordName },
      },
    });

    return {
      sync: await prisma.onlineClassAttendanceSync.findUnique({ where: { id: syncLog.id } }),
      matched: processed,
      unmatched,
    };
  } catch (err) {
    await prisma.onlineClassAttendanceSync.update({
      where: { id: syncLog.id },
      data: {
        syncStatus: 'Failed',
        lastSyncedAt: new Date(),
        errorMessage: err.message || 'Sync failed',
      },
    });
    throw err;
  }
}

async function correctParticipant(schoolId, auth, participantId, input) {
  if (!onlineClassService.isAdminLike(auth) && auth.panel !== 'teacher') {
    throw forbidden('Not allowed to correct attendance.');
  }
  const row = await prisma.onlineClassParticipant.findFirst({
    where: { id: participantId, schoolId },
    include: { onlineClass: true },
  });
  if (!row) throw notFound('Participant not found.');
  if (
    auth.panel === 'teacher' &&
    row.onlineClass.teacherUserId !== auth.userId
  ) {
    throw forbidden('You can only correct attendance on your classes.');
  }

  const status = String(input.attendanceStatus || '').trim();
  const allowed = new Set(['Present', 'Late', 'Absent', 'Partial', 'Pending Verification']);
  if (!allowed.has(status)) throw badRequest('Invalid attendance status.');

  const updated = await prisma.onlineClassParticipant.update({
    where: { id: row.id },
    data: {
      attendanceStatus: status,
      attendedMinutes:
        input.attendedMinutes !== undefined
          ? Math.max(0, Number(input.attendedMinutes) || 0)
          : row.attendedMinutes,
      manuallyVerified: true,
      matchedBy: 'manual',
    },
  });
  return updated;
}

async function listSyncLogs(schoolId, onlineClassId) {
  return prisma.onlineClassAttendanceSync.findMany({
    where: { schoolId, onlineClassId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

/**
 * Automatic sync for classes that ended recently and have a Meet space.
 * Safe to call from a cron or admin "Sync due" action.
 */
async function syncDueClasses(schoolId, auth, { lookbackHours = 48 } = {}) {
  if (!onlineClassService.isAdminLike(auth) && auth.panel !== 'teacher') {
    throw forbidden('Not allowed to run bulk attendance sync.');
  }
  const since = new Date(Date.now() - lookbackHours * 3600_000);
  const where = {
    schoolId,
    meetingSpaceName: { not: null },
    status: { in: ['Live', 'Completed', 'Scheduled'] },
    scheduledAt: { gte: since, lte: new Date() },
  };
  if (auth.panel === 'teacher') where.teacherUserId = auth.userId;

  const rows = await prisma.onlineClass.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    take: 25,
  });

  const results = [];
  for (const row of rows) {
    const ended = Date.now() > row.scheduledAt.getTime() + row.durationMinutes * 60_000;
    if (!ended) continue;
    try {
      const out = await syncClassAttendance(schoolId, auth, row.id);
      results.push({ id: row.id, ok: true, matched: out.matched, unmatched: out.unmatched?.length || 0 });
    } catch (err) {
      results.push({ id: row.id, ok: false, error: err.message });
    }
  }
  return { processed: results.length, results };
}

module.exports = {
  syncClassAttendance,
  correctParticipant,
  listSyncLogs,
  syncDueClasses,
  DEFAULTS,
};
