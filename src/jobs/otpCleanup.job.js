// ============================================
// OTP Cleanup Job — Bond
// Deletes expired/used OTPs to keep table small
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

// Retention config
const USED_OTP_RETENTION_HOURS = 24;        // Used OTPs kept 24h
const EXPIRED_OTP_RETENTION_HOURS = 24;     // Expired OTPs kept 24h
const UNUSED_OTP_MAX_AGE_HOURS = 7 * 24;    // Unused OTPs max 7 days

const otpCleanupJob = async () => {
  const startedAt = Date.now();

  try {
    const now = new Date();

    const usedCutoff = new Date(
      now.getTime() - USED_OTP_RETENTION_HOURS * 60 * 60 * 1000
    );
    const expiredCutoff = new Date(
      now.getTime() - EXPIRED_OTP_RETENTION_HOURS * 60 * 60 * 1000
    );
    const unusedCutoff = new Date(
      now.getTime() - UNUSED_OTP_MAX_AGE_HOURS * 60 * 60 * 1000
    );

    // ============================================
    // 1. Delete used OTPs
    // ============================================
    const usedResult = await prisma.otp.deleteMany({
      where: {
        isUsed: true,
        createdAt: { lt: usedCutoff },
      },
    });

    // ============================================
    // 2. Delete expired OTPs (not used)
    // ============================================
    const expiredResult = await prisma.otp.deleteMany({
      where: {
        isUsed: false,
        expiresAt: { lt: expiredCutoff },
      },
    });

    // ============================================
    // 3. Delete old unused OTPs (safety net)
    // ============================================
    const unusedResult = await prisma.otp.deleteMany({
      where: {
        isUsed: false,
        createdAt: { lt: unusedCutoff },
      },
    });

    const totalDeleted =
      usedResult.count + expiredResult.count + unusedResult.count;
    const duration = Date.now() - startedAt;

    if (totalDeleted > 0) {
      logInfo(
        `📱 OTP cleanup: ${usedResult.count} used, ${expiredResult.count} expired, ${unusedResult.count} unused deleted (${duration}ms)`
      );
    }

    return {
      used: usedResult.count,
      expired: expiredResult.count,
      unused: unusedResult.count,
      total: totalDeleted,
      duration,
    };
  } catch (error) {
    logError('OTP cleanup job failed', error);
    throw error;
  }
};

module.exports = { otpCleanupJob };