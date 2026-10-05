// ============================================
// Notification Cleanup Job — Bond
// Deletes old read notifications (default: 30 days)
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

const DEFAULT_RETENTION_DAYS = 30;
const READ_NOTIFICATION_RETENTION_DAYS = 15;
const UNREAD_NOTIFICATION_RETENTION_DAYS = 60;

const notificationCleanupJob = async () => {
  const startedAt = Date.now();

  try {
    const now = new Date();

    const readCutoff = new Date();
    readCutoff.setDate(readCutoff.getDate() - READ_NOTIFICATION_RETENTION_DAYS);

    const unreadCutoff = new Date();
    unreadCutoff.setDate(unreadCutoff.getDate() - UNREAD_NOTIFICATION_RETENTION_DAYS);

    // ============================================
    // 1. Delete read notifications older than 15 days
    // ============================================
    const readResult = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: { lt: readCutoff },
      },
    });

    // ============================================
    // 2. Delete unread notifications older than 60 days
    // ============================================
    const unreadResult = await prisma.notification.deleteMany({
      where: {
        isRead: false,
        createdAt: { lt: unreadCutoff },
      },
    });

    const totalDeleted = readResult.count + unreadResult.count;
    const duration = Date.now() - startedAt;

    if (totalDeleted > 0) {
      logInfo(
        `🔔 Notification cleanup: ${readResult.count} read + ${unreadResult.count} unread deleted (${duration}ms)`
      );
    }

    return {
      readDeleted: readResult.count,
      unreadDeleted: unreadResult.count,
      totalDeleted,
      duration,
    };
  } catch (error) {
    logError('Notification cleanup job failed', error);
    throw error;
  }
};

module.exports = { notificationCleanupJob };