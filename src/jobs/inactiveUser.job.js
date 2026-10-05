// ============================================
// Inactive User Cleanup Job — Bond
// Marks users inactive for X days as INACTIVE
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

// Config
const INACTIVE_DAYS = 365; // 1 year
const DELETE_AFTER_DAYS = 730; // 2 years → soft delete

const inactiveUserJob = async () => {
  const startedAt = Date.now();

  try {
    // Cutoffs
    const inactiveCutoff = new Date();
    inactiveCutoff.setDate(inactiveCutoff.getDate() - INACTIVE_DAYS);

    const deleteCutoff = new Date();
    deleteCutoff.setDate(deleteCutoff.getDate() - DELETE_AFTER_DAYS);

    // ⭐ 1. Mark inactive (1 year no login)
    const markInactiveResult = await prisma.user.updateMany({
      where: {
        lastLogin: { lt: inactiveCutoff },
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
        role: { not: 'ADMIN' }, // Don't touch admins
      },
      data: {
        status: 'INACTIVE',
        isActive: false,
        isOnline: false,
      },
    });

    // ⭐ 2. Soft delete (2 years no login)
    const softDeleteResult = await prisma.user.updateMany({
      where: {
        lastLogin: { lt: deleteCutoff },
        status: 'INACTIVE',
        deletedAt: null,
        role: { not: 'ADMIN' },
        totalCoins: { lte: 0 }, // No balance
        totalSpent: { lte: 0 }, // Never spent
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        refreshToken: null,
      },
    });

    const duration = Date.now() - startedAt;

    logInfo(
      `👤 Inactive user cleanup: ${markInactiveResult.count} marked inactive, ${softDeleteResult.count} soft deleted (${duration}ms)`
    );

    return {
      markedInactive: markInactiveResult.count,
      softDeleted: softDeleteResult.count,
      duration,
    };
  } catch (error) {
    logError('Inactive user cleanup failed', error);
    throw error;
  }
};

module.exports = { inactiveUserJob };