// ============================================
// Referral Service — Bond (Multi-Level)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');

// ============================================
// Multi-level referral configuration
// ============================================
// Level 1: Direct referral (50 coins)
// Level 2: Indirect referral (10 coins)
// Level 3: Indirect referral (5 coins)
// ============================================

const REFERRAL_LEVELS = {
  1: 50,
  2: 10,
  3: 5,
};

const DEFAULT_BONUS_COINS = 50;

class ReferralService {
  // ============================================
  // 1. GET OR CREATE MY REFERRAL CODE
  // ============================================
  static async getMyReferralCode(userId) {
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    if (!user.referralCode) {
      const code = helpers.generateReferralCode(user.name);

      let existing = await prisma.user.findUnique({ where: { referralCode: code } });
      let attempts = 0;
      let finalCode = code;
      while (existing && attempts < 5) {
        finalCode = helpers.generateReferralCode(user.name);
        existing = await prisma.user.findUnique({ where: { referralCode: finalCode } });
        attempts++;
      }

      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: finalCode },
      });
    }

    return user.referralCode;
  }

  // ============================================
  // 2. VALIDATE REFERRAL CODE
  // ============================================
  static async validateReferralCode(code) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: { id: true, name: true, profileImage: true },
    });
    if (!referrer) throw AppError.badRequest('Invalid referral code');

    return { isValid: true, referrer };
  }

  // ============================================
  // 3. CREATE REFERRAL (with multi-level tracking)
  // ============================================
  static async createReferral(referrerId, referredId, referralCode) {
    if (referrerId === referredId) {
      throw AppError.badRequest('Cannot refer yourself');
    }

    const existing = await prisma.referral.findUnique({ where: { referredId } });
    if (existing) throw AppError.conflict('User already referred');

    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
    });
    if (!referrer || referrer.id !== referrerId) {
      throw AppError.badRequest('Invalid referral code');
    }

    const referral = await prisma.referral.create({
      data: {
        referrerId,
        referredId,
        referralCode: referralCode.toUpperCase(),
        status: 'PENDING',
      },
    });

    logInfo(`Referral created: ${referrerId} → ${referredId}`);
    return referral;
  }

  // ============================================
  // ⭐ 4. GET REFERRAL CHAIN (multi-level)
  // ============================================
  static async getReferralChain(userId, maxLevel = 3) {
    const chain = {
      1: [],
      2: [],
      3: [],
    };

    // Level 1: Direct referrer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, referralCode: true },
    });

    if (!user) return chain;

    // Find who referred this user
    const directReferral = await prisma.referral.findFirst({
      where: { referredId: userId },
      include: { referrer: { select: { id: true, name: true } } },
    });

    if (directReferral?.referrer) {
      chain[1].push(directReferral.referrer);

      // Level 2: Who referred the level-1 referrer
      const level2Referral = await prisma.referral.findFirst({
        where: { referredId: directReferral.referrer.id },
        include: { referrer: { select: { id: true, name: true } } },
      });

      if (level2Referral?.referrer) {
        chain[2].push(level2Referral.referrer);

        // Level 3
        const level3Referral = await prisma.referral.findFirst({
          where: { referredId: level2Referral.referrer.id },
          include: { referrer: { select: { id: true, name: true } } },
        });

        if (level3Referral?.referrer) {
          chain[3].push(level3Referral.referrer);
        }
      }
    }

    return chain;
  }

  // ============================================
  // 5. COMPLETE REFERRAL
  // ============================================
  static async completeReferral(referralId) {
    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) throw AppError.notFound('Referral not found');

    if (['COMPLETED', 'REWARDED'].includes(referral.status)) {
      throw AppError.badRequest('Referral already completed');
    }

    const conditionsMet = await this.checkConditions(referral.referredId);
    if (!conditionsMet) {
      throw AppError.badRequest('Referral conditions not met');
    }

    return prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        conditionsMet: true,
      },
    });
  }

  // ============================================
  // ⭐ 6. REWARD REFERRAL (Multi-Level)
  // ============================================
  static async rewardReferral(referralId, bonusCoins = DEFAULT_BONUS_COINS) {
    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) throw AppError.notFound('Referral not found');

    if (referral.status !== 'COMPLETED') {
      throw AppError.badRequest('Referral not completed yet');
    }
    if (referral.status === 'REWARDED') {
      throw AppError.badRequest('Already rewarded');
    }

    // ============================================
    // Level 1 reward: Direct referrer
    // ============================================
    await WalletService.addCoins(
      referral.referrerId,
      bonusCoins,
      'REFERRAL_BONUS',
      `Referral bonus (Level 1)`,
      { referenceId: referral.id, referenceModel: 'Referral' }
    );

    // Referred user gets half
    const referredBonus = Math.floor(bonusCoins / 2);
    if (referredBonus > 0) {
      await WalletService.addCoins(
        referral.referredId,
        referredBonus,
        'REFERRAL_BONUS',
        `Welcome bonus from referral`,
        { referenceId: referral.id, referenceModel: 'Referral' }
      );
    }

    // ============================================
    // ⭐ Level 2 & 3 rewards: Upline chain
    // ============================================
    try {
      const chain = await this.getReferralChain(referral.referrerId, 3);

      // Level 2 referrer gets bonus
      if (chain[2]?.length > 0) {
        const level2Bonus = REFERRAL_LEVELS[2] || 10;
        for (const upline of chain[2]) {
          await WalletService.addCoins(
            upline.id,
            level2Bonus,
            'REFERRAL_BONUS',
            `Indirect referral bonus (Level 2)`,
            { referenceId: referral.id, referenceModel: 'Referral' }
          );
          logInfo(`Level 2 bonus ${level2Bonus} to ${upline.id}`);
        }
      }

      // Level 3 referrer gets bonus
      if (chain[3]?.length > 0) {
        const level3Bonus = REFERRAL_LEVELS[3] || 5;
        for (const upline of chain[3]) {
          await WalletService.addCoins(
            upline.id,
            level3Bonus,
            'REFERRAL_BONUS',
            `Indirect referral bonus (Level 3)`,
            { referenceId: referral.id, referenceModel: 'Referral' }
          );
          logInfo(`Level 3 bonus ${level3Bonus} to ${upline.id}`);
        }
      }
    } catch (e) {
      logError('Multi-level referral reward failed', e);
    }

    // ============================================
    // Mark as rewarded
    // ============================================
    const updated = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'REWARDED',
        rewardedAt: new Date(),
        coinsRewarded: bonusCoins,
      },
    });

    await prisma.user.update({
      where: { id: referral.referrerId },
      data: { totalReferrals: { increment: 1 } },
    });

    // Notify
    try {
      await NotificationService.createNotification(referral.referrerId, {
        type: 'REWARD',
        title: '🎉 Referral Reward!',
        body: `You earned ${bonusCoins} coins for referring a friend!`,
        channel: 'BOTH',
        priority: 'HIGH',
      });
      await NotificationService.createNotification(referral.referredId, {
        type: 'REWARD',
        title: '🎊 Welcome Bonus!',
        body: `You earned ${referredBonus} coins for joining through a referral!`,
        channel: 'BOTH',
        priority: 'HIGH',
      });
    } catch (e) {}

    return updated;
  }

  // ============================================
  // 7. CHECK CONDITIONS
  // ============================================
  static async checkConditions(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return !!user && user.isActive && user.isVerified;
  }

  // ============================================
  // 8. GET MY REFERRALS (downline)
  // ============================================
  static async getMyReferrals(userId, { page = 1, limit = 20, status } = {}) {
    const where = { referrerId: userId, deletedAt: null };
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: {
          referred: {
            select: {
              id: true, name: true, profileImage: true, isVerified: true, createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.referral.count({ where }),
    ]);

    return {
      data: referrals,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 9. GET MY STATS (with multi-level breakdown)
  // ============================================
  static async getMyStats(userId) {
    const [total, completed, rewarded, pending, coinsEarned] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({ where: { referrerId: userId, status: 'COMPLETED' } }),
      prisma.referral.count({ where: { referrerId: userId, status: 'REWARDED' } }),
      prisma.referral.count({ where: { referrerId: userId, status: 'PENDING' } }),
      prisma.referral.aggregate({
        where: { referrerId: userId, status: 'REWARDED' },
        _sum: { coinsRewarded: true },
      }),
    ]);

    // ⭐ Count indirect referrals (level 2, 3)
    let indirectCount = 0;
    try {
      const chain = await this.getReferralChain(userId, 3);
      indirectCount = (chain[2]?.length || 0) + (chain[3]?.length || 0);
    } catch (e) {}

    return {
      total,
      completed,
      rewarded,
      pending,
      indirect: indirectCount,
      totalCoinsEarned: coinsEarned._sum.coinsRewarded || 0,
    };
  }

  // ============================================
  // 10. PROCESS PENDING REWARDS (cron)
  // ============================================
  static async processPendingRewards() {
    const referrals = await prisma.referral.findMany({
      where: { status: 'COMPLETED' },
    });

    let count = 0;
    for (const ref of referrals) {
      try {
        await this.rewardReferral(ref.id);
        count++;
      } catch (e) {}
    }
    return { processed: count, total: referrals.length };
  }

  // ============================================
  // 11. GET ALL REFERRALS (admin)
  // ============================================
  static async getAllReferrals({ page = 1, limit = 20, status } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: {
          referrer: { select: { id: true, name: true, phone: true } },
          referred: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.referral.count({ where }),
    ]);

    return {
      data: referrals,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }
}

module.exports = ReferralService;