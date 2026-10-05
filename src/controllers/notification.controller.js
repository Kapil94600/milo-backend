// ============================================
// Notification Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const NotificationService = require('../services/notification.service');
const ApiResponse = require('../utils/response');

// ============================================
// USER
// ============================================
const getMyNotifications = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await NotificationService.getMyNotifications(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Notifications fetched');
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await NotificationService.getUnreadCount(req.user.id);
  return ApiResponse.success(res, { unread: count }, 'Unread count fetched');
});

const markAsRead = asyncHandler(async (req, res) => {
  const n = await NotificationService.markAsRead(req.params.id, req.user.id);
  return ApiResponse.success(res, n, 'Marked as read');
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await NotificationService.markAllAsRead(req.user.id);
  return ApiResponse.success(res, result, 'All marked as read');
});

const deleteNotification = asyncHandler(async (req, res) => {
  const n = await NotificationService.deleteNotification(req.params.id, req.user.id);
  return ApiResponse.success(res, n, 'Notification deleted');
});

const deleteAll = asyncHandler(async (req, res) => {
  const result = await NotificationService.deleteAll(req.user.id);
  return ApiResponse.success(res, result, 'All notifications deleted');
});

// ============================================
// ADMIN
// ============================================
const sendToUser = asyncHandler(async (req, res) => {
  const { userId, ...data } = req.body;
  const n = await NotificationService.sendToUser(userId, data);
  return ApiResponse.created(res, n, 'Notification sent');
});

const sendBulk = asyncHandler(async (req, res) => {
  const { userIds, ...data } = req.body;
  const result = await NotificationService.sendBulk(userIds, data);
  return ApiResponse.success(res, result, 'Notifications sent');
});

const broadcast = asyncHandler(async (req, res) => {
  const { role, ...data } = req.body;
  const result = await NotificationService.broadcast(data, role);
  return ApiResponse.success(res, result, 'Broadcast sent');
});
// ============================================
// ⭐ SCHEDULE + HISTORY (NEW)
// ============================================
const scheduleNotification = asyncHandler(async (req, res) => {
  const result = await NotificationService.scheduleNotification(
    req.user.id,
    req.body
  );
  return ApiResponse.created(res, result, 'Notification scheduled');
});

const getScheduledNotifications = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await NotificationService.getScheduledNotifications({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
  });
  return ApiResponse.success(res, result, 'Scheduled notifications fetched');
});

const cancelScheduledNotification = asyncHandler(async (req, res) => {
  const result = await NotificationService.cancelScheduledNotification(
    req.params.id,
    req.user.id
  );
  return ApiResponse.success(res, result, 'Scheduled notification cancelled');
});

const getNotificationHistory = asyncHandler(async (req, res) => {
  const { page, limit, type, status } = req.query;
  const result = await NotificationService.getNotificationHistory({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    type,
    status,
  });
  return ApiResponse.success(res, result, 'Notification history fetched');
});
// ============================================
// Exports
// ============================================
module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAll,
  sendToUser,
  sendBulk,
  broadcast,
    scheduleNotification,
  getScheduledNotifications,
  cancelScheduledNotification,
  getNotificationHistory,
};