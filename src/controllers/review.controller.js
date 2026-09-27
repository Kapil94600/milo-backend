// ============================================
// Review Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const ReviewService = require('../services/review.service');
const ApiResponse = require('../utils/response');

const createReview = asyncHandler(async (req, res) => {
  const review = await ReviewService.createReview(req.user.id, req.body);
  return ApiResponse.created(res, review, 'Review submitted');
});

const getUserReviews = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await ReviewService.getUserReviews(req.params.userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Reviews fetched');
});

const getMyGivenReviews = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await ReviewService.getMyGivenReviews(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'My reviews fetched');
});

const updateReview = asyncHandler(async (req, res) => {
  const review = await ReviewService.updateReview(req.params.id, req.user.id, req.body);
  return ApiResponse.success(res, review, 'Review updated');
});

const deleteReview = asyncHandler(async (req, res) => {
  const review = await ReviewService.deleteReview(req.params.id, req.user.id);
  return ApiResponse.success(res, review, 'Review deleted');
});

const checkCallReview = asyncHandler(async (req, res) => {
  const review = await ReviewService.getCallReview(req.params.callId, req.user.id);
  return ApiResponse.success(res, { hasReviewed: !!review, review });
});

// Admin
const hideReview = asyncHandler(async (req, res) => {
  const review = await ReviewService.hideReview(req.params.id);
  return ApiResponse.success(res, review, 'Review hidden');
});

module.exports = {
  createReview,
  getUserReviews,
  getMyGivenReviews,
  updateReview,
  deleteReview,
  checkCallReview,
  hideReview,
};