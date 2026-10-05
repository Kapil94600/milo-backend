// ============================================
// Report SLA Escalation Job — Bond
// Escalates pending reports after 24h to URGENT priority
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');
const NotificationService = require('../services/notification.service');

const SLA_HOURS = 24;

const reportSlaJob = async () => {
  const startedAt = Date.now();

  try {
    const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

    logInfo(`🚨 Report SLA: checking reports pending > ${SLA_HOURS}h`);

    // ============================================
    // 1. Find overdue pending reports
    // ============================================
    const overdueReports = await prisma.report.findMany({
      where: {
        status: 'PENDING',
        priority: { not: 'URGENT' },
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      select: {
        id: true,
        reporterId: true,
        reportedId: true,
        category: true,
        priority: true,
        createdAt: true,
      },
      take: 100,
    });

    if (overdueReports.length === 0) {
      logInfo('✅ No overdue reports');
      return { escalated: 0, duration: Date.now() - startedAt };
    }

    // ============================================
    // 2. Escalate to URGENT
    // ============================================
    const reportIds = overdueReports.map((r) => r.id);

    const result = await prisma.report.updateMany({
      where: { id: { in: reportIds } },
      data: {
        priority: 'URGENT',
      },
    });

    logInfo(`🚨 Escalated ${result.count} reports to URGENT`);

    // ============================================
    // 3. Notify admins
    // ============================================
    try {
      const admins = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      for (const admin of admins) {
        try {
          await NotificationService.createNotification(admin.id, {
            type: 'SYSTEM',
            title: '🚨 Overdue Reports',
            body: `${result.count} reports have been escalated to URGENT (pending > ${SLA_HOURS}h)`,
            data: { count: result.count, reportIds: reportIds.slice(0, 10) },
            action: 'OPEN_REPORTS',
            channel: 'IN_APP',
            priority: 'HIGH',
          });
        } catch (e) {
          logError(`Failed to notify admin ${admin.id}`, e);
        }
      }
    } catch (e) {
      logError('Failed to notify admins about SLA', e);
    }

    const duration = Date.now() - startedAt;

    return {
      escalated: result.count,
      duration,
    };
  } catch (error) {
    logError('Report SLA job failed', error);
    throw error;
  }
};

module.exports = { reportSlaJob };