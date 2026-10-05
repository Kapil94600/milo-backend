// ============================================
// Subscription Service — Plans + User Subscriptions
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const UploadService = require('./upload.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');
const { PaymentStatus } = require('../common/enums');

class SubscriptionService {
  // ============================================
  // HELPER: Resolve image
  // ============================================
  static async resolvePlanImage(data) {
    if (data._uploadedFile) {
      const result = await UploadService.uploadFile(
        data._uploadedFile,
        'subscription-plans'
      );
      return result.url;
    }
    if (data.image && typeof data.image === 'string' && data.image.trim()) {
      return data.image.trim();
    }
    return null;
  }

  // ============================================
  // 1. CREATE PLAN
  // ============================================
  static async createPlan(data) {
    const imageUrl = await this.resolvePlanImage(data);

    return prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description || null,
        image: imageUrl,
        price: data.price,
        currency: data.currency || 'INR',
        duration: data.duration,
        durationDays: data.durationDays,
        features: data.features || [],
        freeMessages: data.freeMessages || 0,
        freeVoiceMinutes: data.freeVoiceMinutes || 0,
        freeVideoMinutes: data.freeVideoMinutes || 0,
        bonusCoins: data.bonusCoins || 0,
        discountPercent: data.discountPercent || 0,
        prioritySupport: data.prioritySupport ?? false,
        adFree: data.adFree ?? false,
        isPopular: data.isPopular ?? false,
        isActive: data.isActive ?? true,
        order: data.order || 0,
      },
    });
  }

  // ============================================
  // 2. GET PLANS
  // ============================================
  static async getPlans(activeOnly = true) {
    const where = { deletedAt: null };
    if (activeOnly) where.isActive = true;

    return prisma.subscriptionPlan.findMany({
      where,
      orderBy: [{ order: 'asc' }, { price: 'asc' }],
    });
  }

  static async getPlanById(id) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan || plan.deletedAt) throw AppError.notFound('Plan not found');
    return plan;
  }

  // ============================================
  // 3. UPDATE PLAN
  // ============================================
  static async updatePlan(id, data) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Plan not found');

    const allowed = [
      'name', 'description', 'price', 'currency', 'duration', 'durationDays',
      'features', 'freeMessages', 'freeVoiceMinutes', 'freeVideoMinutes',
      'bonusCoins', 'discountPercent', 'prioritySupport', 'adFree',
      'isPopular', 'isActive', 'order',
    ];
    const updates = helpers.pick(data, allowed);

    if (data._uploadedFile || data.image !== undefined) {
      updates.image = await this.resolvePlanImage(data);
    }

    return prisma.subscriptionPlan.update({ where: { id }, data: updates });
  }

  // ============================================
  // 4. DELETE PLAN
  // ============================================
  static async deletePlan(id) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Plan not found');

    // Check for active subscriptions
    const activeCount = await prisma.subscription.count({
      where: { planId: id, isActive: true, endDate: { gt: new Date() } },
    });

    if (activeCount > 0) {
      throw AppError.badRequest(
        `Cannot delete plan with ${activeCount} active subscriptions`
      );
    }

    return prisma.subscriptionPlan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================
  // 5. SUBSCRIBE
  // ============================================
   static async subscribe(userId, planId, autoRenew = false) {
    const plan = await this.getPlanById(planId);
    if (!plan.isActive) throw AppError.badRequest('Plan not available');

    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (existing) {
      throw AppError.conflict('You already have an active subscription');
    }

    const wallet = await WalletService.getWallet(userId);
    if (wallet.balance < plan.price) {
      throw AppError.badRequest(`Insufficient balance. Need ₹${plan.price}`);
    }

    const startDate = new Date();
    const endDate = helpers.addDays(startDate, plan.durationDays);

    const subscription = await prisma.$transaction(async (tx) => {
      // Atomic balance check + deduct
      const updated = await tx.wallet.updateMany({
        where: { userId, balance: { gte: plan.price } },
        data: {
          balance: { decrement: plan.price },
          totalSpent: { increment: plan.price },
        },
      });

      if (updated.count === 0) {
        throw AppError.badRequest('Insufficient balance');
      }

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEBIT',
          category: 'SUBSCRIPTION',
          amount: plan.price,
          coins: 0,
          description: `Subscribed to ${plan.name}`,
          status: 'COMPLETED',
          referenceModel: 'SubscriptionPlan',
          referenceId: plan.id,
        },
      });

      const sub = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          startDate,
          endDate,
          isActive: true,
          autoRenew,
          paymentStatus: 'COMPLETED',
          amount: plan.price,
          currency: plan.currency,
          features: {
            freeMessages: plan.freeMessages,
            freeVoiceMinutes: plan.freeVoiceMinutes,
            freeVideoMinutes: plan.freeVideoMinutes,
            bonusCoins: plan.bonusCoins,
            discountPercent: plan.discountPercent,
            prioritySupport: plan.prioritySupport,
            adFree: plan.adFree,
          },
          usage: {
            messagesUsed: 0,
            voiceMinutesUsed: 0,
            videoMinutesUsed: 0,
            coinsUsed: 0,
          },
        },
        include: { plan: true },
      });

      // Bonus coins
      if (plan.bonusCoins > 0) {
        const wallet2 = await tx.wallet.update({
          where: { userId },
          data: {
            coins: { increment: plan.bonusCoins },
            totalEarned: { increment: plan.bonusCoins },
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            category: 'SUBSCRIPTION',
            amount: 0,
            coins: plan.bonusCoins,
            description: `Bonus coins from ${plan.name}`,
            status: 'COMPLETED',
            balanceAfter: wallet2.balance,
            coinsAfter: wallet2.coins,
            referenceModel: 'Subscription',
            referenceId: sub.id,
          },
        });
      }

      return sub;
    });

    logInfo(`User ${userId} subscribed to ${plan.name}`);

    // Notify
    NotificationService.sendSubscriptionNotification(userId, plan, 'ACTIVATED').catch(
      () => {}
    );

    return subscription;
  }

  // ============================================
  // 6. GET ACTIVE SUBSCRIPTION
  // ============================================
  static async getActiveSubscription(userId) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
      include: { plan: true },
    });
  }

  // ============================================
  // 7. GET MY SUBSCRIPTIONS (history)
  // ============================================
  static async getMySubscriptions(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId, deletedAt: null },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      data: subscriptions,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 8. CANCEL SUBSCRIPTION
  // ============================================
  static async cancelSubscription(userId) {
    const sub = await prisma.subscription.findFirst({
      where: { userId, isActive: true, endDate: { gt: new Date() } },
    });
    if (!sub) throw AppError.notFound('No active subscription');

    return prisma.subscription.update({
      where: { id: sub.id },
      data: { autoRenew: false, cancelledAt: new Date() },
    });
  }

  // ============================================
  // 9. HAS ACTIVE SUBSCRIPTION
  // ============================================
  static async hasActiveSubscription(userId) {
    const count = await prisma.subscription.count({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
    });
    return count > 0;
  }

  // ============================================
  // 10. UPDATE USAGE
  // ============================================
  static async updateUsage(userId, type, amount = 1) {
    const sub = await prisma.subscription.findFirst({
      where: { userId, isActive: true, endDate: { gt: new Date() } },
    });
    if (!sub) return null;

    const usage = sub.usage || {
      messagesUsed: 0,
      voiceMinutesUsed: 0,
      videoMinutesUsed: 0,
      coinsUsed: 0,
    };

    if (type === 'message') usage.messagesUsed = (usage.messagesUsed || 0) + amount;
    else if (type === 'voice') usage.voiceMinutesUsed = (usage.voiceMinutesUsed || 0) + amount;
    else if (type === 'video') usage.videoMinutesUsed = (usage.videoMinutesUsed || 0) + amount;
    else if (type === 'coins') usage.coinsUsed = (usage.coinsUsed || 0) + amount;

    return prisma.subscription.update({
      where: { id: sub.id },
      data: { usage },
    });
  }

  // ============================================
  // 11. CHECK + RENEW EXPIRING (cron)
  // ============================================
  static async checkAndRenewSubscriptions() {
    const now = new Date();
    const tomorrow = helpers.addDays(now, 1);

    const expiring = await prisma.subscription.findMany({
      where: {
        isActive: true,
        autoRenew: true,
        endDate: { gt: now, lte: tomorrow },
        deletedAt: null,
      },
      include: { plan: true },
    });

    let renewed = 0;
    let failed = 0;

    for (const sub of expiring) {
      try {
        const wallet = await WalletService.getWallet(sub.userId);

        if (wallet.balance >= sub.plan.price) {
          const newEnd = helpers.addDays(sub.endDate, sub.plan.durationDays);

          await prisma.$transaction(async (tx) => {
            await tx.wallet.update({
              where: { userId: sub.userId },
              data: {
                balance: { decrement: sub.plan.price },
                totalSpent: { increment: sub.plan.price },
              },
            });

            await tx.transaction.create({
              data: {
                userId: sub.userId,
                type: 'DEBIT',
                category: 'SUBSCRIPTION',
                amount: sub.plan.price,
                coins: 0,
                description: `Auto-renewal: ${sub.plan.name}`,
                status: 'COMPLETED',
              },
            });

            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                startDate: sub.endDate,
                endDate: newEnd,
                paymentStatus: 'COMPLETED',
              },
            });
          });

          // Notify
          NotificationService.sendSubscriptionNotification(
            sub.userId,
            sub.plan,
            'RENEWED'
          ).catch(() => {});

          renewed++;
        } else {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { autoRenew: false },
          });
          failed++;
        }
      } catch (e) {
        logError(`Auto-renewal failed for ${sub.id}`, e);
        failed++;
      }
    }

    return { renewed, failed };
  }

  // ============================================
  // 12. GET STATS
  // ============================================
  static async getStats() {
    const [active, expired, total, revenue] = await Promise.all([
      prisma.subscription.count({
        where: { isActive: true, endDate: { gt: new Date() } },
      }),
      prisma.subscription.count({
        where: { endDate: { lt: new Date() } },
      }),
      prisma.subscription.count(),
      prisma.subscription.aggregate({
        where: { paymentStatus: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    return {
      active,
      expired,
      total,
      totalRevenue: revenue._sum.amount || 0,
    };
  }

  // ============================================
  // 13. GET PLAN SUBSCRIPTIONS
  // ============================================
  static async getPlanSubscriptions(planId) {
    return prisma.subscription.findMany({
      where: {
        planId,
        isActive: true,
        endDate: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }
    // ============================================
  // ⭐ UPGRADE SUBSCRIPTION (NEW)
  // ============================================
  static async upgradeSubscription(userId, newPlanId, autoRenew = false) {
    const newPlan = await this.getPlanById(newPlanId);
    if (!newPlan.isActive) throw AppError.badRequest('Plan not available');

    const currentSub = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
      include: { plan: true },
    });

    if (!currentSub) {
      // No active subscription → just subscribe normally
      return this.subscribe(userId, newPlanId, autoRenew);
    }

    // Validate: new plan must be "higher" (or user must confirm downgrade)
    const currentPrice = currentSub.plan.price;
    const newPrice = newPlan.price;

    const isUpgrade = newPrice > currentPrice;
    const isDowngrade = newPrice < currentPrice;

    // Calculate proration
    const now = new Date();
    const endDate = new Date(currentSub.endDate);
    const remainingMs = endDate - now;
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    const currentDailyRate = currentPrice / currentSub.plan.durationDays;
    const creditValue = currentDailyRate * remainingDays;

    const newDailyRate = newPlan.price / newPlan.durationDays;
    const newPeriodValue = newDailyRate * remainingDays;
    const proratedCost = Math.max(0, newPeriodValue - creditValue);

    // Check wallet balance
    const wallet = await WalletService.getWallet(userId);
    if (wallet.balance < proratedCost) {
      throw AppError.badRequest(
        `Insufficient balance. Need ₹${proratedCost.toFixed(2)} for upgrade.`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cancel old subscription
      await tx.subscription.update({
        where: { id: currentSub.id },
        data: {
          isActive: false,
          cancelledAt: now,
          autoRenew: false,
        },
      });

      // Deduct prorated cost
      if (proratedCost > 0) {
        const updated = await tx.wallet.updateMany({
          where: { userId, balance: { gte: proratedCost } },
          data: {
            balance: { decrement: proratedCost },
            totalSpent: { increment: proratedCost },
          },
        });

        if (updated.count === 0) {
          throw new Error('Insufficient balance');
        }

        await tx.transaction.create({
          data: {
            userId,
            type: 'DEBIT',
            category: 'SUBSCRIPTION',
            amount: proratedCost,
            coins: 0,
            description: `Upgrade to ${newPlan.name} (prorated)`,
            status: 'COMPLETED',
            referenceModel: 'SubscriptionPlan',
            referenceId: newPlan.id,
          },
        });
      }

      // Create new subscription with remaining time
      const newSub = await tx.subscription.create({
        data: {
          userId,
          planId: newPlan.id,
          startDate: now,
          endDate: endDate, // Same end date (no extension)
          isActive: true,
          autoRenew,
          paymentStatus: 'COMPLETED',
          amount: proratedCost,
          currency: newPlan.currency,
          features: {
            freeMessages: newPlan.freeMessages,
            freeVoiceMinutes: newPlan.freeVoiceMinutes,
            freeVideoMinutes: newPlan.freeVideoMinutes,
            bonusCoins: newPlan.bonusCoins,
            discountPercent: newPlan.discountPercent,
            prioritySupport: newPlan.prioritySupport,
            adFree: newPlan.adFree,
          },
          usage: {
            messagesUsed: 0,
            voiceMinutesUsed: 0,
            videoMinutesUsed: 0,
            coinsUsed: 0,
          },
        },
        include: { plan: true },
      });

      // Bonus coins from new plan
      if (newPlan.bonusCoins > 0) {
        const wallet2 = await tx.wallet.update({
          where: { userId },
          data: {
            coins: { increment: newPlan.bonusCoins },
            totalEarned: { increment: newPlan.bonusCoins },
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            category: 'SUBSCRIPTION',
            amount: 0,
            coins: newPlan.bonusCoins,
            description: `Bonus coins from ${newPlan.name}`,
            status: 'COMPLETED',
            balanceAfter: wallet2.balance,
            coinsAfter: wallet2.coins,
            referenceModel: 'Subscription',
            referenceId: newSub.id,
          },
        });
      }

      return newSub;
    });

    logInfo(
      `User ${userId} ${isUpgrade ? 'upgraded' : isDowngrade ? 'downgraded' : 'changed'} to ${newPlan.name}`
    );

    // Notify
    NotificationService.sendSubscriptionNotification(
      userId,
      newPlan,
      isUpgrade ? 'ACTIVATED' : 'RENEWED'
    ).catch(() => {});

    return {
      subscription: result,
      upgrade: {
        isUpgrade,
        isDowngrade,
        proratedCost: Math.round(proratedCost * 100) / 100,
        creditValue: Math.round(creditValue * 100) / 100,
        remainingDays,
      },
    };
  }

  // ============================================
  // ⭐ PREVIEW UPGRADE COST (NEW)
  // ============================================
  static async previewUpgrade(userId, newPlanId) {
    const newPlan = await this.getPlanById(newPlanId);
    if (!newPlan.isActive) throw AppError.badRequest('Plan not available');

    const currentSub = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
      include: { plan: true },
    });

    if (!currentSub) {
      return {
        hasExisting: false,
        planName: newPlan.name,
        price: newPlan.price,
        durationDays: newPlan.durationDays,
        proratedCost: newPlan.price,
        message: 'No active subscription — full price applies',
      };
    }

    const now = new Date();
    const endDate = new Date(currentSub.endDate);
    const remainingMs = endDate - now;
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    const currentDailyRate = currentSub.plan.price / currentSub.plan.durationDays;
    const creditValue = currentDailyRate * remainingDays;

    const newDailyRate = newPlan.price / newPlan.durationDays;
    const newPeriodValue = newDailyRate * remainingDays;
    const proratedCost = Math.max(0, newPeriodValue - creditValue);

    return {
      hasExisting: true,
      currentPlan: {
        name: currentSub.plan.name,
        price: currentSub.plan.price,
        remainingDays,
      },
      newPlan: {
        name: newPlan.name,
        price: newPlan.price,
        durationDays: newPlan.durationDays,
      },
      calculation: {
        creditValue: Math.round(creditValue * 100) / 100,
        newPeriodValue: Math.round(newPeriodValue * 100) / 100,
        proratedCost: Math.round(proratedCost * 100) / 100,
      },
      isUpgrade: newPlan.price > currentSub.plan.price,
      isDowngrade: newPlan.price < currentSub.plan.price,
    };
  }
    // ============================================
  // ⭐ SUBSCRIBE WITH PROMO (NEW)
  // ============================================
  static async subscribeWithPromo(userId, planId, promoCode = null, autoRenew = false) {
    const plan = await this.getPlanById(planId);
    if (!plan.isActive) throw AppError.badRequest('Plan not available');

    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (existing) {
      throw AppError.conflict('You already have an active subscription');
    }

    let promo = null;
    let discount = 0;
    let finalPrice = plan.price;

    // ⭐ Apply promo if provided
    if (promoCode) {
      const PromoService = require('./promo.service');
      const promoResult = await PromoService.validatePromo(
        promoCode,
        userId,
        plan.price
      );

      promo = promoResult.promo;
      discount = promoResult.discount;
      finalPrice = Math.max(0, plan.price - discount);
    }

    // Check wallet
    const wallet = await WalletService.getWallet(userId);
    if (wallet.balance < finalPrice) {
      throw AppError.badRequest(
        `Insufficient balance. Need ₹${finalPrice.toFixed(2)}`
      );
    }

    const startDate = new Date();
    const endDate = helpers.addDays(startDate, plan.durationDays);

    const subscription = await prisma.$transaction(async (tx) => {
      // Deduct (finalPrice after discount)
      const updated = await tx.wallet.updateMany({
        where: { userId, balance: { gte: finalPrice } },
        data: {
          balance: { decrement: finalPrice },
          totalSpent: { increment: finalPrice },
        },
      });

      if (updated.count === 0) {
        throw AppError.badRequest('Insufficient balance');
      }

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEBIT',
          category: 'SUBSCRIPTION',
          amount: finalPrice,
          coins: 0,
          description: `Subscribed to ${plan.name}${
            promo ? ` (promo: ${promo.code}, -₹${discount})` : ''
          }`,
          status: 'COMPLETED',
          referenceModel: 'SubscriptionPlan',
          referenceId: plan.id,
        },
      });

      const sub = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          startDate,
          endDate,
          isActive: true,
          autoRenew,
          paymentStatus: 'COMPLETED',
          amount: finalPrice,
          currency: plan.currency,
          features: {
            freeMessages: plan.freeMessages,
            freeVoiceMinutes: plan.freeVoiceMinutes,
            freeVideoMinutes: plan.freeVideoMinutes,
            bonusCoins: plan.bonusCoins,
            discountPercent: plan.discountPercent,
            prioritySupport: plan.prioritySupport,
            adFree: plan.adFree,
          },
          usage: {
            messagesUsed: 0,
            voiceMinutesUsed: 0,
            videoMinutesUsed: 0,
            coinsUsed: 0,
          },
          data: promo ? { promoCode: promo.code, discount } : null,
        },
        include: { plan: true },
      });

      // Bonus coins
      if (plan.bonusCoins > 0) {
        const wallet2 = await tx.wallet.update({
          where: { userId },
          data: {
            coins: { increment: plan.bonusCoins },
            totalEarned: { increment: plan.bonusCoins },
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            category: 'SUBSCRIPTION',
            amount: 0,
            coins: plan.bonusCoins,
            description: `Bonus coins from ${plan.name}`,
            status: 'COMPLETED',
            balanceAfter: wallet2.balance,
            coinsAfter: wallet2.coins,
            referenceModel: 'Subscription',
            referenceId: sub.id,
          },
        });
      }

      // ⭐ Record promo usage
      if (promo) {
        await tx.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });

        await tx.promoUsage.create({
          data: {
            promoId: promo.id,
            userId,
            discount,
            orderId: sub.id,
          },
        });
      }

      return sub;
    });

    logInfo(
      `User ${userId} subscribed to ${plan.name}${promo ? ` with promo ${promo.code}` : ''}`
    );

    NotificationService.sendSubscriptionNotification(
      userId,
      plan,
      'ACTIVATED'
    ).catch(() => {});

    return {
      subscription,
      promo: promo ? { code: promo.code, discount } : null,
      paid: finalPrice,
    };
  }
}

module.exports = SubscriptionService;