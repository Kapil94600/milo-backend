// ============================================
// Girl Weekly Report Job — Bond
// Sends weekly earnings summary to girls
// ============================================

const { prisma } = require('../config/database');
const EmailService = require('../services/email.service');
const NotificationService = require('../services/notification.service');
const { logInfo, logError } = require('../utils/logger');

const girlWeeklyReportJob = async () => {
  const startedAt = Date.now();

  try {
    // Get all active, verified girls
    const girls = await prisma.girl.findMany({
      where: {
        status: 'ACTIVE',
        isVerified: true,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    let sent = 0;
    let failed = 0;

    for (const girl of girls) {
      try {
        // Get last week's stats
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [calls, messages, gifts] = await Promise.all([
          prisma.call.count({
            where: {
              receiverId: girl.userId,
              status: 'ENDED',
              createdAt: { gte: weekAgo },
            },
          }),
          prisma.message.count({
            where: {
              senderId: girl.userId,
              createdAt: { gte: weekAgo },
              deletedAt: null,
            },
          }),
          prisma.giftTransaction.count({
            where: {
              receiverId: girl.userId,
              status: 'COMPLETED',
              createdAt: { gte: weekAgo },
            },
          }),
        ]);

        const wallet = await prisma.wallet.findUnique({
          where: { userId: girl.userId },
        });

        // Skip if no activity
        if (calls === 0 && messages === 0 && gifts === 0) {
          continue;
        }

        // Build report
        const report = {
          girlName: girl.user.name,
          week: {
            calls,
            messages,
            gifts,
            earningsToday: girl.earningsToday || 0,
            earningsThisWeek: girl.earningsThisWeek || 0,
            balance: wallet?.balance || 0,
            coins: wallet?.coins || 0,
          },
          total: {
            earningsTotal: girl.earningsTotal || 0,
            totalCalls: girl.totalCalls || 0,
            totalMessages: girl.totalMessages || 0,
          },
        };

        // Send notification (in-app)
        await NotificationService.createNotification(girl.userId, {
          type: 'SYSTEM',
          title: '📊 Weekly Earnings Report',
          body: `You earned ₹${report.week.earningsThisWeek.toFixed(2)} this week from ${calls} calls, ${messages} messages, and ${gifts} gifts.`,
          data: report,
          action: 'OPEN_EARNINGS',
          channel: 'IN_APP',
          priority: 'NORMAL',
        });

        // Send email if available
        if (girl.user.email) {
          EmailService.send({
            to: girl.user.email,
            subject: `Your weekly earnings on Bond`,
            html: buildWeeklyReportEmail(report),
          }).catch((e) => logError('Weekly email failed', e));
        }

        sent++;
      } catch (e) {
        failed++;
        logError(`Weekly report failed for girl ${girl.id}`, e);
      }
    }

    const duration = Date.now() - startedAt;

    logInfo(
      `📊 Girl weekly report: ${sent} sent, ${failed} failed (${duration}ms)`
    );

    return { sent, failed, total: girls.length, duration };
  } catch (error) {
    logError('Girl weekly report job failed', error);
    throw error;
  }
};

// ============================================
// Email template
// ============================================
const buildWeeklyReportEmail = (report) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #4C1D95, #7C3AED); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; }
        .content { padding: 30px; }
        .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
        .stat { flex: 1 1 45%; background: #F5F3FF; padding: 16px; border-radius: 12px; }
        .stat-label { color: #6B7280; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .stat-value { color: #7C3AED; font-size: 24px; font-weight: 800; margin-top: 4px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Weekly Report</h1>
        </div>
        <div class="content">
          <h2>Hi ${report.girlName}!</h2>
          <p>Here's your weekly summary:</p>
          
          <div class="stats">
            <div class="stat">
              <div class="stat-label">Earnings This Week</div>
              <div class="stat-value">₹${report.week.earningsThisWeek.toFixed(2)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Total Earnings</div>
              <div class="stat-value">₹${report.total.earningsTotal.toFixed(2)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Calls</div>
              <div class="stat-value">${report.week.calls}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Messages</div>
              <div class="stat-value">${report.week.messages}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Gifts</div>
              <div class="stat-value">${report.week.gifts}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Current Balance</div>
              <div class="stat-value">₹${report.week.balance.toFixed(2)}</div>
            </div>
          </div>
          
          <p>Keep up the great work! 💪</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Bond. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { girlWeeklyReportJob };