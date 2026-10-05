// ============================================
// Girl Auto-Payout Job — Bond
// Weekly scheduled payouts for eligible girls
// ============================================

const GirlService = require('../services/girl.service');
const { logInfo, logError } = require('../utils/logger');

const girlPayoutJob = async () => {
  const startedAt = Date.now();

  try {
    logInfo('💰 Girl auto-payout: starting');

    const result = await GirlService.runAutoPayout();

    const duration = Date.now() - startedAt;

    logInfo(
      `💰 Girl auto-payout complete: ${result.success} success, ${result.skipped} skipped, ${result.failed} failed (₹${result.totalAmount}) — ${duration}ms`
    );

    return result;
  } catch (error) {
    logError('Girl auto-payout job failed', error);
    throw error;
  }
};

module.exports = { girlPayoutJob };