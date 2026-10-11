const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const notificationService = require('../../services/notifications/notification.service');

const list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listForUser(req.auth.userId, {
    limit: req.query.limit,
    unreadOnly: String(req.query.unreadOnly || '') === 'true',
  });
  const unread = await notificationService.unreadCount(req.auth.userId);
  return ApiResponse.ok(res, 'Notifications loaded.', { notifications, unread });
});

const unread = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.auth.userId);
  return ApiResponse.ok(res, 'Unread count.', { unread: count });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.auth.userId, req.params.id);
  return ApiResponse.ok(res, 'Notification marked read.', { notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.auth.userId);
  return ApiResponse.ok(res, 'All notifications marked read.', result);
});

const pendingFloat = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listPendingFloat(req.auth.userId, {
    limit: req.query.limit,
  });
  return ApiResponse.ok(res, 'Pending floating notifications.', { notifications });
});

const markFloated = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await notificationService.markFloated(req.auth.userId, ids);
  return ApiResponse.ok(res, 'Floating notifications acknowledged.', result);
});

module.exports = {
  list,
  unread,
  markRead,
  markAllRead,
  pendingFloat,
  markFloated,
};
