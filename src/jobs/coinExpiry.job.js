// ============================================
// Coin Expiry Job — Bond
// Expires old coins (default: 90 days)
// Configurable via settings: COIN_EXPIRY_DAYS
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

const DEFAULT_EXPIRY_DAYS = 90;
const MIN_EXPIRY_DAYS = 30;

const coinExpiryJob = async () => {
  const startedAt = Date.now();

  try {
    // ============================================
    // 1. Get expiry days from settings
    // ============================================
    let expiryDays = DEFAULT_EXPIRY_DAYS;
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'COIN_EXPIRY_DAYS' },
      });
      if (setting?.value) {
        expiryDays = Number(setting.value) || DEFAULT_EXPIRY_DAYS;
      }
    } catch (e) {
      // use default
    }

    // Skip if disabled (0 or negative)
    if (expiryDays <= 0) {
      logInfo('Coin expiry disabled (COIN_EXPIRY_DAYS <= 0)');
      return { expired: 0, disabled: true };
    }

    // Cap minimum
    if (expiryDays < MIN_EXPIRY_DAYS) {
      expiryDays = MIN_EXPIRY_DAYS;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - expiryDays);

    logInfo(`🪙 Coin expiry: processing coins older than ${expiryDays} days`);

    // ============================================
    // 2. Find wallets with old coins
    // ============================================
    // This is a simplified expiry: for proper FIFO expiry, you need
    // a coin ledger. Here we just decrement unused coins after N days.
    // ============================================

    const wallets = await prisma.wallet.findMany({
      where: {
        coins: { gt: 0 },
        updatedAt: { lt: cutoffDate },
      },
      select: {
        id: true,
        userId: true,
        coins: true,
        totalEarned: true,
      },
      take: 500, // batch
    });

    let expired = 0;
    let totalCoinsExpired = 0;
    let failed = 0;

    for (const wallet of wallets) {
      try {
        // Check if user has any recent transaction (activity)
        const recentTx = await prisma.transaction.findFirst({
          where: {
            userId: wallet.userId,
            createdAt: { gte: cutoffDate },
            deletedAt: null,
          },
          select: { id: true },
        });

        // User active hai to coins expire nahi karo
        if (recentTx) continue;

        // Expire all unused coins
        const coinsToExpire = wallet.coins;

        await prisma.$transaction(async (tx) => {
          // Deduct from wallet
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              coins: { decrement: coinsToExpire },
            },
          });

          // Update user total
          await tx.user.update({
            where: { id: wallet.userId },
            data: { totalCoins: { decrement: coinsToExpire } },
          });

          // Log transaction
          await tx.transaction.create({
            data: {
              userId: wallet.userId,
              type: 'DEBIT',
              category: 'ADMIN_ADD', // reused — could add COIN_EXPIRY enum
              amount: 0,
              coins: coinsToExpire,
              description: `Coins expired (inactive ${expiryDays}+ days)`,
              status: 'COMPLETED',
            },
          });
        });

        expired++;
        totalCoinsExpired += coinsToExpire;
      } catch (e) {
        logError(`Coin expiry failed for wallet ${wallet.id}`, e);
        failed++;
      }
    }

    const duration = Date.now() - startedAt;

    logInfo(
      `🪙 Coin expiry completed: ${expired} wallets, ${totalCoinsExpired} coins expired (${failed} failed, ${duration}ms)`
    );

    return {
      expired,
      totalCoinsExpired,
      failed,
      expiryDays,
      duration,
    };
  } catch (error) {
    logError('Coin expiry job failed', error);
    throw error;
  }
};

module.exports = { coinExpiryJob };