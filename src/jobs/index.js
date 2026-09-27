// ============================================
// Cron Jobs Registry
// ============================================

const cron = require('node-cron');
const { logInfo, logError } = require('../utils/logger');

// Import jobs
const { dailyBonusJob } = require('./dailyBonus.job');
const { expiredBlocksJob } = require('./expiredBlocks.job');
const { subscriptionRenewalJob } = require('./subscriptionRenewal.job');

// ============================================
// Registry of all jobs
// ============================================
const jobs = [
  {
    name: 'Daily Bonus',
    schedule: '0 0 * * *', // Every day at midnight
    handler: dailyBonusJob,
  },
  {
    name: 'Expired Blocks Cleanup',
    schedule: '*/30 * * * *', // Every 30 minutes
    handler: expiredBlocksJob,
  },
  {
    name: 'Subscription Renewal',
    schedule: '0 */6 * * *', // Every 6 hours
    handler: subscriptionRenewalJob,
  },
];

// Track running job instances to prevent overlap
const runningJobs = new Map();

// ============================================
// Start all jobs
// ============================================
const startJobs = () => {
  logInfo('🕐 Starting cron jobs...');

  jobs.forEach(({ name, schedule, handler }) => {
    try {
      if (!cron.validate(schedule)) {
        logError(`Invalid cron schedule for ${name}: ${schedule}`);
        return;
      }

      cron.schedule(schedule, async () => {
        // Prevent overlapping runs
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

// ============================================
// Manual trigger (for testing/admin)
// ============================================
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