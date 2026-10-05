// ============================================
// Cron Jobs Registry — Bond (Complete)
// ============================================

const cron = require('node-cron');
const { logInfo, logError } = require('../utils/logger');

// Import jobs
const { dailyBonusJob } = require('./dailyBonus.job');
const { expiredBlocksJob } = require('./expiredBlocks.job');
const { subscriptionRenewalJob } = require('./subscriptionRenewal.job');
const { callTimeoutJob } = require('./callTimeout.job');
const { coinExpiryJob } = require('./coinExpiry.job');
const { reportSlaJob } = require('./reportSla.job');
const { notificationCleanupJob } = require('./notificationCleanup.job');
const { failedPaymentCleanupJob } = require('./failedPaymentCleanup.job');
const { otpCleanupJob } = require('./otpCleanup.job');
const { girlPayoutJob } = require('./girlPayout.job');
const { inactiveUserJob } = require('./inactiveUser.job'); // ⭐ NEW
const { girlWeeklyReportJob } = require('./girlWeeklyReport.job'); // ⭐ NEW
const { adminDigestJob } = require('./adminDigest.job'); // ⭐ NEW
const { scheduledNotificationJob } = require('./scheduledNotification.job');
// ============================================
// Registry — 13 crons
// ============================================
const jobs = [
  // Daily bonus at midnight
  { name: 'Daily Bonus', schedule: '0 0 * * *', handler: dailyBonusJob },

  // Every 30 min — expired blocks
  { name: 'Expired Blocks Cleanup', schedule: '*/30 * * * *', handler: expiredBlocksJob },

  // Every 6 hours — subscription renewal
  { name: 'Subscription Renewal', schedule: '0 */6 * * *', handler: subscriptionRenewalJob },

  // Every 5 min — call timeout
  { name: 'Call Timeout Cleanup', schedule: '*/5 * * * *', handler: callTimeoutJob },

  // Daily 3 AM — coin expiry
  { name: 'Coin Expiry', schedule: '0 3 * * *', handler: coinExpiryJob },

  // Hourly — report SLA escalation
  { name: 'Report SLA Escalation', schedule: '0 * * * *', handler: reportSlaJob },

  // Daily 4 AM — notification cleanup
  { name: 'Notification Cleanup', schedule: '0 4 * * *', handler: notificationCleanupJob },

  // Every 15 min — failed payment cleanup
  { name: 'Failed Payment Cleanup', schedule: '*/15 * * * *', handler: failedPaymentCleanupJob },

  // Every 6 hours — OTP cleanup
  { name: 'OTP Cleanup', schedule: '0 */6 * * *', handler: otpCleanupJob },

  // Monday 10 AM — girl auto-payout
  { name: 'Girl Auto-Payout', schedule: '0 10 * * 1', handler: girlPayoutJob },

  // ⭐ Daily 5 AM — inactive users cleanup
  { name: 'Inactive User Cleanup', schedule: '0 5 * * *', handler: inactiveUserJob },

  // ⭐ Monday 9 AM — girl weekly report
  { name: 'Girl Weekly Report', schedule: '0 9 * * 1', handler: girlWeeklyReportJob },

  // ⭐ Daily 9 AM — admin digest
  { name: 'Admin Daily Digest', schedule: '0 9 * * *', handler: adminDigestJob },
  // ⭐ Every 1 min — send scheduled notifications
{ name: 'Scheduled Notifications', schedule: '* * * * *', handler: scheduledNotificationJob },
];

const runningJobs = new Map();

const startJobs = () => {
  logInfo('🕐 Starting cron jobs...');

  jobs.forEach(({ name, schedule, handler }) => {
    try {
      if (!cron.validate(schedule)) {
        logError(`Invalid cron schedule for ${name}: ${schedule}`);
        return;
      }

      cron.schedule(schedule, async () => {
        if (runningJobs.get(name)) {
          logInfo(`⏭️  Skipping ${name} — still running`);
          return;
        }

        runningJobs.set(name, true);
        logInfo(`🔄 Running job: ${name}`);
        const startedAt = Date.now();

        try {
          await handler();
          const duration = Date.now() - startedAt;
          logInfo(`✅ Job completed: ${name} (${duration}ms)`);
        } catch (error) {
          logError(`❌ Job failed: ${name}`, error);
        } finally {
          runningJobs.set(name, false);
        }
      });

      logInfo(`✅ Scheduled: ${name} (${schedule})`);
    } catch (error) {
      logError(`Failed to schedule ${name}`, error);
    }
  });

  logInfo(`✅ ${jobs.length} cron jobs registered`);
};

const runJobNow = async (jobName) => {
  const job = jobs.find((j) => j.name === jobName);
  if (!job) throw new Error(`Job not found: ${jobName}`);

  if (runningJobs.get(jobName)) {
    throw new Error(`Job ${jobName} is already running`);
  }

  runningJobs.set(jobName, true);
  logInfo(`🔄 Running job manually: ${jobName}`);

  try {
    const result = await job.handler();
    logInfo(`✅ Job completed: ${jobName}`);
    return { success: true, result };
  } finally {
    runningJobs.set(jobName, false);
  }
};

module.exports = { startJobs, runJobNow, jobs };