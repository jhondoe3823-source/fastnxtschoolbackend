/**
 * Meeting controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const meetingService = require('../../services/meetings/meeting.service');

const listMeetings = asyncHandler(async (req, res) => {
  const meetings = await meetingService.listMeetings(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Meetings loaded successfully.', { meetings });
});

const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await meetingService.getMeeting(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Meeting loaded successfully.', { meeting });
});

const createMeeting = asyncHandler(async (req, res) => {
  const meeting = await meetingService.createMeeting(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Meeting created successfully.', { meeting });
});

const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await meetingService.updateMeeting(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Meeting updated successfully.', { meeting });
});

const deleteMeeting = asyncHandler(async (req, res) => {
  await meetingService.deleteMeeting(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Meeting deleted successfully.', { deleted: true });
});

module.exports = { listMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting };
