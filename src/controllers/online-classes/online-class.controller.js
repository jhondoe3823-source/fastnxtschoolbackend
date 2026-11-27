const asyncHandler = require('../../utils/async-handler');
const ApiResponse = require('../../utils/response');
const onlineClassService = require('../../services/online-classes/online-class.service');
const attendanceSync = require('../../services/online-classes/attendance-sync.service');
const googleOAuth = require('../../services/integrations/google-oauth.service');
const env = require('../../config/env');

const dashboard = asyncHandler(async (req, res) => {
  const data = await onlineClassService.dashboard(req.auth.schoolId, req.auth, req.query);
  return ApiResponse.ok(res, 'Online classes dashboard loaded.', data);
});

const list = asyncHandler(async (req, res) => {
  const data = await onlineClassService.listClasses(req.auth.schoolId, req.auth, req.query);
  return ApiResponse.ok(res, 'Online classes loaded.', data);
});

const getOne = asyncHandler(async (req, res) => {
  const data = await onlineClassService.getClass(req.auth.schoolId, req.auth, req.params.id);
  return ApiResponse.ok(res, 'Online class loaded.', data);
});

const create = asyncHandler(async (req, res) => {
  const onlineClass = await onlineClassService.createClass(req.auth.schoolId, req.auth, req.body);
  return ApiResponse.created(res, 'Online class created with Google Meet.', { class: onlineClass });
});

const update = asyncHandler(async (req, res) => {
  const onlineClass = await onlineClassService.updateClass(
    req.auth.schoolId,
    req.auth,
    req.params.id,
    req.body
  );
  return ApiResponse.ok(res, 'Online class updated.', { class: onlineClass });
});

const cancel = asyncHandler(async (req, res) => {
  const onlineClass = await onlineClassService.cancelClass(
    req.auth.schoolId,
    req.auth,
    req.params.id,
    req.body?.reason
  );
  return ApiResponse.ok(res, 'Online class cancelled.', { class: onlineClass });
});

const remove = asyncHandler(async (req, res) => {
  const data = await onlineClassService.deleteClass(req.auth.schoolId, req.auth, req.params.id);
  return ApiResponse.ok(res, 'Online class deleted.', data);
});

const join = asyncHandler(async (req, res) => {
  const data = await onlineClassService.joinClass(req.auth.schoolId, req.auth, req.params.id);
  return ApiResponse.ok(res, 'Join link ready.', data);
});

const syncAttendance = asyncHandler(async (req, res) => {
  const data = await attendanceSync.syncClassAttendance(
    req.auth.schoolId,
    req.auth,
    req.params.id,
    { force: Boolean(req.body?.force) }
  );
  return ApiResponse.ok(res, 'Attendance sync finished.', data);
});

const correctParticipant = asyncHandler(async (req, res) => {
  const participant = await attendanceSync.correctParticipant(
    req.auth.schoolId,
    req.auth,
    req.params.participantId,
    req.body
  );
  return ApiResponse.ok(res, 'Attendance corrected.', { participant });
});

const syncLogs = asyncHandler(async (req, res) => {
  const logs = await attendanceSync.listSyncLogs(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Sync logs loaded.', { logs });
});

const syncDue = asyncHandler(async (req, res) => {
  const data = await attendanceSync.syncDueClasses(req.auth.schoolId, req.auth, {
    lookbackHours: Number(req.body?.lookbackHours) || 48,
  });
  const reminders = await onlineClassService.notifyStartingSoon(req.auth.schoolId, {
    withinMinutes: Number(req.body?.withinMinutes) || 15,
  });
  return ApiResponse.ok(res, 'Due attendance sync finished.', { ...data, reminders });
});

const googleStatus = asyncHandler(async (req, res) => {
  const integration = await googleOAuth.getIntegration(req.auth.schoolId, req.auth.userId);
  return ApiResponse.ok(res, 'Google integration status.', {
    configured: googleOAuth.googleConfigured(),
    integration,
  });
});

const googleConnect = asyncHandler(async (req, res) => {
  const url = googleOAuth.buildAuthUrl({
    schoolId: req.auth.schoolId,
    userId: req.auth.userId,
    returnTo: req.query.returnTo || '/online-classes/settings',
  });
  return ApiResponse.ok(res, 'Google OAuth URL ready.', { url });
});

const googleDisconnect = asyncHandler(async (req, res) => {
  const data = await googleOAuth.disconnect(req.auth.schoolId, req.auth.userId);
  return ApiResponse.ok(res, 'Google account disconnected.', data);
});

/** OAuth callback — public route (state carries auth). */
const googleCallback = asyncHandler(async (req, res) => {
  if (req.query.error) {
    const dest = `${env.brand.appUrl}/online-classes/settings?google=error&message=${encodeURIComponent(req.query.error)}`;
    return res.redirect(dest);
  }
  const result = await googleOAuth.handleCallback({
    code: req.query.code,
    state: req.query.state,
  });
  const dest = `${env.brand.appUrl}${result.returnTo}?google=connected`;
  return res.redirect(dest);
});

const eligibleStudents = asyncHandler(async (req, res) => {
  const students = await onlineClassService.listEligibleStudents(req.auth.schoolId, {
    cls: req.query.cls,
    section: req.query.section,
    branchId: req.query.branchId,
  });
  return ApiResponse.ok(res, 'Eligible students loaded.', { students });
});

module.exports = {
  dashboard,
  list,
  getOne,
  create,
  update,
  cancel,
  remove,
  join,
  syncAttendance,
  correctParticipant,
  syncLogs,
  syncDue,
  googleStatus,
  googleConnect,
  googleDisconnect,
  googleCallback,
  eligibleStudents,
};
