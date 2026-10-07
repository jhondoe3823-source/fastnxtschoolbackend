/**
 * Notice controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const noticeService = require('../../services/communication/notice.service');

const listNotices = asyncHandler(async (req, res) => {
  const notices = await noticeService.listNotices(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Notices loaded successfully.', { notices });
});

const getNotice = asyncHandler(async (req, res) => {
  const notice = await noticeService.getNotice(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Notice loaded successfully.', { notice });
});

const createNotice = asyncHandler(async (req, res) => {
  const notice = await noticeService.createNotice(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Notice created successfully.', { notice });
});

const updateNotice = asyncHandler(async (req, res) => {
  const notice = await noticeService.updateNotice(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Notice updated successfully.', { notice });
});

const deleteNotice = asyncHandler(async (req, res) => {
  await noticeService.deleteNotice(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Notice deleted successfully.', { deleted: true });
});

module.exports = { listNotices, getNotice, createNotice, updateNotice, deleteNotice };
