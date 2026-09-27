// ============================================
// Daily Bonus Job
// Gives bonus coins to users who logged in today
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

const DEFAULT_BONUS = 10;

const dailyBonusJob = async () => {
  // Get bonus amount from settings
  let bonusAmount = DEFAULT_BONUS;
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'COIN_DAILY_BONUS' },
    });
    if (setting?.value) bonusAmount = parseInt(setting.value);
  } catch (e) {
    logError('Failed to read daily bonus setting', e);
  }

  if (bonusAmount <= 0) {
    logInfo('Daily bonus disabled (amount = 0)');
    return { sent: 0, bonusAmount: 0 };
  }

  // Get users who logged in today but haven't received bonus
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      lastLogin: { gte: todayStart },
    },
    select: { id: true, name: true },
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      // Check if bonus already given today
      const existing = await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          category: 'DAILY_BONUS',
          createdAt: { gte: todayStart },
        },
      });

      if (existing) continue;

      // Give bonus
      await prisma.$transaction(async (tx) => {
        let wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { userId: user.id, balance: 0, coins: 0 },
          });
        }

        const updated = await tx.wallet.update({
          where: { userId: user.id },
          data: {
            coins: { increment: bonusAmount },
            totalEarned: { increment: bonusAmount },
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { totalCoins: { increment: bonusAmount } },
        });

        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'CREDIT',
            category: 'DAILY_BONUS',
            amount: 0,
            coins: bonusAmount,
            description: `Daily login bonus`,
            status: 'COMPLETED',
            balanceAfter: updated.balance,
            coinsAfter: updated.coins,
          },
        });
      });

      sent++;
    } catch (error) {
      logError(`Daily bonus failed for ${user.id}`, error);
      failed++;
    }
  }

  logInfo(`Daily bonus: sent ${sent} bonuses of ${bonusAmount} coins (${failed} failed)`);
  return { sent, failed, bonusAmount };
};

module.exports = { dailyBonusJob };