// ============================================
// Notification Routes
// ============================================

const express = require('express');
const NotificationController = require('../controllers/notification.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const NotificationValidator = require('../validators/notification.validator');

const router = express.Router();

router.use(authenticate);

// ============================================
// USER — SPECIFIC first
// ============================================
router.get(
  '/',
  validate(NotificationValidator.paginationQuery),
  NotificationController.getMyNotifications
);
router.get('/unread/count', NotificationController.getUnreadCount);
router.put('/read-all', NotificationController.markAllAsRead);
router.delete('/delete-all', NotificationController.deleteAll);

// ============================================
// ADMIN
// ============================================
router.post('/admin/send', requireAdmin, validate(NotificationValidator.sendToUser), NotificationController.sendToUser);
router.post('/admin/send-bulk', requireAdmin, validate(NotificationValidator.sendBulk), NotificationController.sendBulk);
router.post('/admin/broadcast', requireAdmin, validate(NotificationValidator.broadcast), NotificationController.broadcast);

// ============================================
// Dynamic LAST
// ============================================
router.put('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.deleteNotification);

module.exports = router;