// ============================================
// Review Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');

class ReviewService {
  // ============================================
  // 1. CREATE REVIEW
  // ============================================
  static async createReview(reviewerId, data) {
    const { reviewedId, rating, comment, callId, isAnonymous = false } = data;

    if (reviewerId === reviewedId) {
      throw AppError.badRequest('Cannot review yourself');
    }

    if (rating < 1 || rating > 5) {
      throw AppError.badRequest('Rating must be between 1 and 5');
    }

    const reviewed = await prisma.user.findUnique({ where: { id: reviewedId } });
    if (!reviewed) throw AppError.notFound('User not found');

    // Check if already reviewed (for this call or general)
    if (callId) {
      const existing = await prisma.review.findFirst({
        where: { reviewerId, reviewedId, callId },
      });
      if (existing) throw AppError.conflict('Already reviewed this call');
    }

    const review = await prisma.review.create({
      data: {
        reviewerId,
        reviewedId,
        rating,
        comment,
        callId: callId || null,
        isAnonymous,
      },
      include: {
        reviewer: { select: { id: true, name: true, profileImage: true } },
        reviewed: { select: { id: true, name: true, profileImage: true } },
      },
    });

    // If reviewed user is a girl, update girl's rating
    const girl = await prisma.girl.findUnique({ where: { userId: reviewedId } });
    if (girl) {
      const totalReviews = girl.totalReviews + 1;
      const newRating = (girl.rating * girl.totalReviews + rating) / totalReviews;

      await prisma.girl.update({
        where: { userId: reviewedId },
        data: {
          rating: helpers.round(newRating, 2),
          totalReviews,
        },
      });
    }

    logInfo(`Review created: ${review.id}`);
    return review;
  }

  // ============================================
  // 2. GET REVIEWS FOR USER
  // ============================================
  static async getUserReviews(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { reviewedId: userId, isVisible: true, deletedAt: null },
        include: {
          reviewer: { select: { id: true, name: true, profileImage: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { reviewedId: userId, isVisible: true, deletedAt: null } }),
    ]);

    // Hide reviewer if anonymous
    const sanitized = reviews.map((r) => ({
      ...r,
      reviewer: r.isAnonymous ? null : r.reviewer,
    }));

    // Calculate average
    const avg = await prisma.review.aggregate({
      where: { reviewedId: userId, isVisible: true, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      data: sanitized,
      averageRating: helpers.round(avg._avg.rating || 0, 2),
      totalReviews: avg._count._all || 0,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 3. GET MY REVIEWS (given by me)
  // ============================================
  static async getMyGivenReviews(reviewerId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { reviewerId, deletedAt: null },
        include: {
          reviewed: { select: { id: true, name: true, profileImage: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { reviewerId, deletedAt: null } }),
    ]);

    return {
      data: reviews,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. UPDATE REVIEW
  // ============================================
  static async updateReview(reviewId, userId, data) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw AppError.notFound('Review not found');
    if (review.reviewerId !== userId) throw AppError.forbidden('Not authorized');

    return prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: data.rating,
        comment: data.comment,
      },
    });
  }

  // ============================================
  // 5. DELETE REVIEW
  // ============================================
  static async deleteReview(reviewId, userId) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw AppError.notFound('Review not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';

    if (review.reviewerId !== userId && !isAdmin) {
      throw AppError.forbidden('Not authorized');
    }

    return prisma.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================
  // 6. HIDE REVIEW (admin)
  // ============================================
  static async hideReview(reviewId) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw AppError.notFound('Review not found');

    return prisma.review.update({
      where: { id: reviewId },
      data: { isVisible: false },
    });
  }

  // ============================================
  // 7. GET REVIEWS FOR CALL
  // ============================================
  static async getCallReview(callId, reviewerId) {
    return prisma.review.findFirst({
      where: { callId, reviewerId },
    });
  }
}

module.exports = ReviewService;