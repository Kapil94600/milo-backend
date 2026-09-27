// ============================================
// Referral Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const ReferralService = require('../services/referral.service');
const ApiResponse = require('../utils/response');

// User
const getMyCode = asyncHandler(async (req, res) => {
  const code = await ReferralService.getMyReferralCode(req.user.id);
  return ApiResponse.success(res, { referralCode: code }, 'Referral code');
});

const validateCode = asyncHandler(async (req, res) => {
  const result = await ReferralService.validateReferralCode(req.params.code);
  return ApiResponse.success(res, result, 'Code validated');
});

const getMyReferrals = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await ReferralService.getMyReferrals(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
  });
  return ApiResponse.success(res, result, 'Referrals fetched');
});

const getMyStats = asyncHandler(async (req, res) => {
  const stats = await ReferralService.getMyStats(req.user.id);
  return ApiResponse.success(res, stats, 'Stats fetched');
});

// Admin
const completeReferral = asyncHandler(async (req, res) => {
  const result = await ReferralService.completeReferral(req.params.id);
  return ApiResponse.success(res, result, 'Referral completed');
});

const rewardReferral = asyncHandler(async (req, res) => {
  const { bonusCoins } = req.body;
  const result = await ReferralService.rewardReferral(req.params.id, bonusCoins);
  return ApiResponse.success(res, result, 'Referral rewarded');
});

const getAllReferrals = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await ReferralService.getAllReferrals({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
  });
  return ApiResponse.success(res, result, 'All referrals fetched');
});

const processPendingRewards = asyncHandler(async (req, res) => {
  const result = await ReferralService.processPendingRewards();
  return ApiResponse.success(res, result, 'Pending rewards processed');
});

module.exports = {
  getMyCode,
  validateCode,
  getMyReferrals,
  getMyStats,
  completeReferral,
  rewardReferral,
  getAllReferrals,
  processPendingRewards,
};