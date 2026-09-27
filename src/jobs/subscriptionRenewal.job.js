// ============================================
// Subscription Renewal Job
// ============================================

const SubscriptionService = require('../services/subscription.service');
const { logInfo, logError } = require('../utils/logger');

const subscriptionRenewalJob = async () => {
  try {
    const result = await SubscriptionService.checkAndRenewSubscriptions();
    logInfo(
      `Subscription renewal: ${result.renewed} renewed, ${result.failed} failed`
    );
    return result;
  } catch (error) {
    logError('Subscription renewal job failed', error);
    throw error;
  }
};

module.exports = { subscriptionRenewalJob };