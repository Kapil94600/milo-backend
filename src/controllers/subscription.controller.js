// ============================================
// Subscription Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const SubscriptionService = require('../services/subscription.service');
const ApiResponse = require('../utils/response');

// ============================================
// PUBLIC
// ============================================
const getPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionService.getPlans(true);
  return ApiResponse.success(res, plans, 'Plans fetched');
});

const getPlanById = asyncHandler(async (req, res) => {
  const plan = await SubscriptionService.getPlanById(req.params.id);
  return ApiResponse.success(res, plan, 'Plan fetched');
});

// ============================================
// USER
// ============================================
const subscribe = asyncHandler(async (req, res) => {
  const { planId, autoRenew } = req.body;
  const sub = await SubscriptionService.subscribe(req.user.id, planId, autoRenew || false);
  return ApiResponse.created(res, sub, 'Subscribed successfully');
});

const getMySubscription = asyncHandler(async (req, res) => {
  const sub = await SubscriptionService.getActiveSubscription(req.user.id);
  return ApiResponse.success(res, sub, 'Subscription fetched');
});

const getMySubscriptions = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await SubscriptionService.getMySubscriptions(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Subscriptions fetched');
});

const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await SubscriptionService.cancelSubscription(req.user.id);
  return ApiResponse.success(res, sub, 'Subscription cancelled');
});

const checkActive = asyncHandler(async (req, res) => {
  const hasActive = await SubscriptionService.hasActiveSubscription(req.user.id);
  return ApiResponse.success(res, { hasActiveSubscription: hasActive });
});

// ============================================
// ADMIN — Create Plan (supports file upload)
// ============================================
const createPlan = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded file (if multipart)
  if (req.file) {
    data._uploadedFile = req.file;
  }

  const plan = await SubscriptionService.createPlan(data);
  return ApiResponse.created(res, plan, 'Plan created');
});

// ============================================
// ADMIN — Update Plan (supports file upload)
// ============================================
const updatePlan = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  if (req.file) {
    data._uploadedFile = req.file;
  }

  const plan = await SubscriptionService.updatePlan(req.params.id, data);
  return ApiResponse.success(res, plan, 'Plan updated');
});

// ============================================
// ADMIN — Other
// ============================================
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionService.deletePlan(req.params.id);
  return ApiResponse.success(res, plan, 'Plan deleted');
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await SubscriptionService.getStats();
  return ApiResponse.success(res, stats, 'Stats fetched');
});

const getPlanSubscriptions = asyncHandler(async (req, res) => {
  const subs = await SubscriptionService.getPlanSubscriptions(req.params.id);
  return ApiResponse.success(res, subs, 'Subscriptions fetched');
});

const renewSubscriptions = asyncHandler(async (req, res) => {
  const result = await SubscriptionService.checkAndRenewSubscriptions();
  return ApiResponse.success(res, result, 'Renewal complete');
});

// ⭐ Upgrade subscription
const upgradeSubscription = asyncHandler(async (req, res) => {
  const { planId, autoRenew } = req.body;
  const result = await SubscriptionService.upgradeSubscription(
    req.user.id,
    planId,
    autoRenew || false
  );
  return ApiResponse.success(res, result, 'Subscription updated');
});

// ⭐ Preview upgrade cost
const previewUpgrade = asyncHandler(async (req, res) => {
  const result = await SubscriptionService.previewUpgrade(
    req.user.id,
    req.params.planId
  );
  return ApiResponse.success(res, result, 'Upgrade preview');
});
// ============================================
// ⭐ Subscribe with promo (NEW)
// ============================================
const subscribeWithPromo = asyncHandler(async (req, res) => {
  const { planId, promoCode, autoRenew } = req.body;

  const result = await SubscriptionService.subscribeWithPromo(
    req.user.id,
    planId,
    promoCode || null,
    autoRenew || false
  );

  return ApiResponse.created(res, result, 'Subscribed successfully');
});
// ============================================
// Exports
// ============================================
module.exports = {
  getPlans,
  getPlanById,
  subscribe,
  getMySubscription,
  getMySubscriptions,
  cancelSubscription,
  checkActive,
  createPlan,
  updatePlan,
  deletePlan,
  getStats,
  getPlanSubscriptions,
  renewSubscriptions,
  upgradeSubscription,
  previewUpgrade,
   subscribeWithPromo,
};