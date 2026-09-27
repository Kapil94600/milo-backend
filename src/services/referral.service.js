// ============================================
// Referral Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const NotificationService = require('./notification.service');
const { logInfo } = require('../utils/logger');

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

      // Ensure unique
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

    return {
      isValid: true,
      referrer,
    };
  }

  // ============================================
  // 3. CREATE REFERRAL (called during signup)
  // ============================================
  static async createReferral(referrerId, referredId, referralCode) {
    if (referrerId === referredId) {
      throw AppError.badRequest('Cannot refer yourself');
    }

    // Check if already referred
    const existing = await prisma.referral.findUnique({ where: { referredId } });
    if (existing) throw AppError.conflict('User already referred');

    // Verify code
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
  // 4. COMPLETE REFERRAL
  // ============================================
  static async completeReferral(referralId) {
    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) throw AppError.notFound('Referral not found');

    if (['COMPLETED', 'REWARDED'].includes(referral.status)) {
      throw AppError.badRequest('Referral already completed');
    }

    // Check conditions (e.g., user made first purchase)
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
  // 5. REWARD REFERRAL
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

    // Give coins to referrer
    await WalletService.addCoins(
      referral.referrerId,
      bonusCoins,
      'REFERRAL_BONUS',
      `Referral bonus`,
      { referenceId: referral.id, referenceModel: 'Referral' }
    );

    // Give 50% to referred
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

    // Update referral
    const updated = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'REWARDED',
        rewardedAt: new Date(),
        coinsRewarded: bonusCoins,
      },
    });

    // Update stats
    await prisma.user.update({
      where: { id: referral.referrerId },
      data: { totalReferrals: { increment: 1 } },
    });

    // Notifications
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
    } catch (e) {
      // silent
    }

    return updated;
  }

  // ============================================
  // 6. CHECK CONDITIONS
  // ============================================
  static async checkConditions(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return !!user && user.isActive && user.isVerified;
  }

  // ============================================
  // 7. GET MY REFERRALS
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
              id: true,
              name: true,
              profileImage: true,
              isVerified: true,
              createdAt: true,
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
  // 8. GET MY REFERRAL STATS
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

    return {
      total,
      completed,
      rewarded,
      pending,
      totalCoinsEarned: coinsEarned._sum.coinsRewarded || 0,
    };
  }

  // ============================================
  // 9. PROCESS ALL PENDING REWARDS (cron)
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
      } catch (e) {
        // silent
      }
    }
    return { processed: count, total: referrals.length };
  }

  // ============================================
  // 10. ADMIN: Get all referrals
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