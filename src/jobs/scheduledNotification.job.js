// ============================================
// Scheduled Notification Job — Bond
// Sends scheduled notifications when due
// ============================================

const { prisma } = require('../config/database');
const NotificationService = require('../services/notification.service');
const { logInfo, logError } = require('../utils/logger');

const scheduledNotificationJob = async () => {
  const startedAt = Date.now();

  try {
    const now = new Date();

    // Find due notifications
    const dueNotifications = await prisma.scheduledNotification.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    if (dueNotifications.length === 0) {
      return { sent: 0, duration: Date.now() - startedAt };
    }

    logInfo(`📅 Processing ${dueNotifications.length} scheduled notifications`);

    let sent = 0;
    let failed = 0;

    for (const notification of dueNotifications) {
      try {
        await NotificationService.sendScheduledNotification(notification.id);
        sent++;
      } catch (e) {
        failed++;
        logError(`Scheduled notification ${notification.id} failed`, e);
      }
    }

    const duration = Date.now() - startedAt;

    logInfo(
      `📅 Scheduled notifications processed: ${sent} sent, ${failed} failed (${duration}ms)`
    );

    return { sent, failed, total: dueNotifications.length, duration };
  } catch (error) {
    logError('Scheduled notification job failed', error);
    throw error;
  }
};

module.exports = { scheduledNotificationJob };