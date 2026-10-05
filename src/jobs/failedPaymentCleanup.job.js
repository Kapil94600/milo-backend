// ============================================
// Failed Payment Cleanup Job — Bond
// Marks stale PENDING payments as FAILED (after 30 min)
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

// Payment timeout (30 minutes)
const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

const failedPaymentCleanupJob = async () => {
  const startedAt = Date.now();

  try {
    const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MS);

    logInfo('💳 Payment cleanup: checking stale PENDING transactions');

    // ============================================
    // 1. Find stale pending transactions
    // ============================================
    const stalePayments = await prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        category: { in: ['COIN_PURCHASE', 'SUBSCRIPTION'] },
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        category: true,
        amount: true,
        coins: true,
        referenceId: true,
        createdAt: true,
      },
      take: 200,
    });

    if (stalePayments.length === 0) {
      logInfo('✅ No stale payments');
      return { failed: 0, duration: Date.now() - startedAt };
    }

    // ============================================
    // 2. Mark them as failed
    // ============================================
    const paymentIds = stalePayments.map((p) => p.id);

    const result = await prisma.transaction.updateMany({
      where: { id: { in: paymentIds } },
      data: {
        status: 'FAILED',
        failureReason: 'Payment timeout — not completed within 30 minutes',
      },
    });

    logInfo(`💳 Marked ${result.count} stale payments as FAILED`);

    // ============================================
    // 3. Also cleanup stale withdrawals pending > 7 days (return to balance)
    // ============================================
    const withdrawalCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const staleWithdrawals = await prisma.withdrawal.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        createdAt: { lt: withdrawalCutoff },
      },
      select: { id: true, userId: true, amount: true },
      take: 100,
    });

    let withdrawalCleaned = 0;
    for (const w of staleWithdrawals) {
      try {
        await prisma.$transaction(async (tx) => {
          // Refund
          await tx.wallet.update({
            where: { userId: w.userId },
            data: {
              pendingBalance: { decrement: w.amount },
              balance: { increment: w.amount },
            },
          });

          // Mark withdrawal failed
          await tx.withdrawal.update({
            where: { id: w.id },
            data: {
              status: 'REJECTED',
              failureReason: 'Auto-rejected — pending > 7 days',
              processedAt: new Date(),
            },
          });

          // Update original transaction
          await tx.transaction.updateMany({
            where: {
              referenceId: w.id,
              referenceModel: 'Withdrawal',
            },
            data: {
              status: 'FAILED',
              failureReason: 'Auto-rejected after 7 days',
            },
          });
        });

        withdrawalCleaned++;
      } catch (e) {
        logError(`Failed to cleanup withdrawal ${w.id}`, e);
      }
    }

    if (withdrawalCleaned > 0) {
      logInfo(`💳 Auto-rejected ${withdrawalCleaned} stale withdrawals`);
    }

    const duration = Date.now() - startedAt;

    return {
      failed: result.count,
      withdrawalsCleaned: withdrawalCleaned,
      duration,
    };
  } catch (error) {
    logError('Failed payment cleanup job failed', error);
    throw error;
  }
};

module.exports = { failedPaymentCleanupJob };