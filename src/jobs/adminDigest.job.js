// ============================================
// Admin Daily Digest Job — Bond
// Sends daily summary to all admins
// ============================================

const { prisma } = require('../config/database');
const NotificationService = require('../services/notification.service');
const AdminService = require('../services/admin.service');
const { logInfo, logError } = require('../utils/logger');

const adminDigestJob = async () => {
  const startedAt = Date.now();

  try {
    // Get dashboard stats
    const stats = await AdminService.getDashboardStats();

    // Get all active admins
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (admins.length === 0) {
      return { sent: 0, admins: 0 };
    }

    // Build digest message
    const title = '📊 Daily Digest';
    const body = `Users: ${stats.users.total} | Girls: ${stats.users.girls} | Online: ${stats.users.online} | Revenue: ₹${stats.finance.totalRevenue.toFixed(2)} | Pending: ${stats.pending.reports + stats.pending.tickets + stats.pending.withdrawals} items`;

    let sent = 0;
    let failed = 0;

    for (const admin of admins) {
      try {
        await NotificationService.createNotification(admin.id, {
          type: 'SYSTEM',
          title,
          body,
          data: {
            users: stats.users,
            finance: stats.finance,
            pending: stats.pending,
            activity: stats.activity,
          },
          action: 'OPEN_DASHBOARD',
          channel: 'IN_APP',
          priority: 'NORMAL',
        });
        sent++;
      } catch (e) {
        failed++;
        logError(`Admin digest failed for ${admin.id}`, e);
      }
    }

    const duration = Date.now() - startedAt;

    logInfo(`📊 Admin digest: ${sent} sent, ${failed} failed (${duration}ms)`);

    return { sent, failed, admins: admins.length, duration };
  } catch (error) {
    logError('Admin digest job failed', error);
    throw error;
  }
};

module.exports = { adminDigestJob };