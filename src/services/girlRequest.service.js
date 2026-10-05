// ============================================
// Girl Request Service — Bond (NEW)
// Separate service for girl request flow
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { logInfo } = require('../utils/logger');
const { ROLES, GirlRequestStatus } = require('../common/enums');

class GirlRequestService {
  // ============================================
  // ⭐ 1. CAN REQUEST? (Pre-check before opening onboarding)
  // ============================================
  static async canRequest(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, status: true },
    });

    if (!user) {
      return {
        canRequest: false,
        reason: 'USER_NOT_FOUND',
        message: 'User not found',
      };
    }

    if (!user.isActive || user.status === 'BLOCKED') {
      return {
        canRequest: false,
        reason: 'USER_INACTIVE',
        message: 'Your account is not active',
      };
    }

    if (user.role === ROLES.GIRL) {
      return {
        canRequest: false,
        reason: 'ALREADY_GIRL',
        message: 'You are already a registered girl',
      };
    }

    if (user.role === ROLES.ADMIN) {
      return {
        canRequest: false,
        reason: 'ADMIN_NOT_ALLOWED',
        message: 'Admins cannot become girls',
      };
    }

    // Check existing request
    const existing = await prisma.girlRequest.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === GirlRequestStatus.PENDING) {
        return {
          canRequest: false,
          reason: 'PENDING_EXISTS',
          message: 'Your request is already pending approval',
          existingRequest: {
            id: existing.id,
            status: existing.status,
            createdAt: existing.createdAt,
          },
        };
      }

      if (existing.status === GirlRequestStatus.APPROVED) {
        return {
          canRequest: false,
          reason: 'ALREADY_APPROVED',
          message: 'Your request has already been approved',
        };
      }

      // REJECTED → can re-apply
      return {
        canRequest: true,
        reason: 'CAN_REAPPLY',
        message: 'You can re-apply after previous rejection',
        previousRejection: {
          reason: existing.rejectionReason,
          reviewedAt: existing.reviewedAt,
        },
      };
    }

    return {
      canRequest: true,
      reason: 'ELIGIBLE',
      message: 'You are eligible to apply',
    };
  }

  // ============================================
  // ⭐ 2. CANCEL REQUEST (Self — only if PENDING)
  // ============================================
  static async cancelRequest(userId) {
    const request = await prisma.girlRequest.findUnique({
      where: { userId },
    });

    if (!request) {
      throw AppError.notFound('No request found to cancel');
    }

    if (request.status !== GirlRequestStatus.PENDING) {
      throw AppError.badRequest(
        `Cannot cancel request with status: ${request.status}`
      );
    }

    // Soft delete — mark as cancelled
    const updated = await prisma.girlRequest.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        deletedAt: new Date(),
      },
    });

    logInfo(`Girl request cancelled by user: ${userId}`);
    return {
      message: 'Request cancelled successfully',
      request: updated,
    };
  }

  // ============================================
  // 3. GET MY REQUEST (with can-request info)
  // ============================================
  static async getMyRequest(userId) {
    const [request, canInfo] = await Promise.all([
      prisma.girlRequest.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              profileImage: true,
            },
          },
        },
      }),
      this.canRequest(userId),
    ]);

    return {
      request: request || null,
      canRequest: canInfo,
    };
  }
}

module.exports = GirlRequestService;