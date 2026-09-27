// ============================================
// Block Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');

class BlockService {
  // ============================================
  // 1. BLOCK USER
  // ============================================
  static async blockUser(userId, blockedId, reason = null, expiresAt = null) {
    if (userId === blockedId) {
      throw AppError.badRequest('Cannot block yourself');
    }

    // Check if user exists
    const blocked = await prisma.user.findUnique({ where: { id: blockedId } });
    if (!blocked) throw AppError.notFound('User not found');

    // Check if already blocked
    const existing = await prisma.blockedUser.findFirst({
      where: { userId, blockedId },
    });

    if (existing && !existing.deletedAt) {
      throw AppError.conflict('User already blocked');
    }

    // If previously blocked (soft deleted), reactivate
    if (existing && existing.deletedAt) {
      return prisma.blockedUser.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isPermanent: !expiresAt,
        },
      });
    }

    // Create new block
    const block = await prisma.blockedUser.create({
      data: {
        userId,
        blockedId,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isPermanent: !expiresAt,
      },
    });

    logInfo(`User ${userId} blocked ${blockedId}`);
    return block;
  }

  // ============================================
  // 2. UNBLOCK USER
  // ============================================
  static async unblockUser(userId, blockedId) {
    const block = await prisma.blockedUser.findFirst({
      where: { userId, blockedId, deletedAt: null },
    });

    if (!block) throw AppError.notFound('Block not found');

    return prisma.blockedUser.update({
      where: { id: block.id },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================
  // 3. GET MY BLOCKED USERS
  // ============================================
  static async getMyBlockedUsers(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [blocks, total] = await Promise.all([
      prisma.blockedUser.findMany({
        where: { userId, deletedAt: null },
        include: {
          blocked: {
            select: {
              id: true,
              name: true,
              phone: true,
              profileImage: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blockedUser.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      data: blocks,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. CHECK IF BLOCKED (one-way)
  // ============================================
  static async isBlocked(userId, targetId) {
    const block = await prisma.blockedUser.findFirst({
      where: {
        userId,
        blockedId: targetId,
        deletedAt: null,
        OR: [{ isPermanent: true }, { expiresAt: { gt: new Date() } }],
      },
    });
    return !!block;
  }

  // ============================================
  // 5. CHECK IF BLOCKED (both ways)
  // ============================================
  static async isBlockedEitherWay(userId, targetId) {
    const block = await prisma.blockedUser.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { userId, blockedId: targetId },
          { userId: targetId, blockedId: userId },
        ],
        AND: [
          {
            OR: [{ isPermanent: true }, { expiresAt: { gt: new Date() } }],
          },
        ],
      },
    });
    return !!block;
  }

  // ============================================
  // 6. CLEANUP EXPIRED BLOCKS (cron)
  // ============================================
  static async cleanupExpired() {
    const result = await prisma.blockedUser.updateMany({
      where: {
        isPermanent: false,
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    return { cleaned: result.count };
  }

  // ============================================
  // 7. GET BLOCK COUNT
  // ============================================
  static async getBlockCount(userId) {
    return prisma.blockedUser.count({
      where: { userId, deletedAt: null },
    });
  }
}

module.exports = BlockService;