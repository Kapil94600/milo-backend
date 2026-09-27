// ============================================
// Favorite Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');

class FavoriteService {
  // ============================================
  // 1. ADD FAVORITE
  // ============================================
  static async addFavorite(userId, favoriteId, notes = null) {
    if (userId === favoriteId) {
      throw AppError.badRequest('Cannot favorite yourself');
    }

    const user = await prisma.user.findUnique({ where: { id: favoriteId } });
    if (!user) throw AppError.notFound('User not found');

    const existing = await prisma.favorite.findFirst({
      where: { userId, favoriteId },
    });

    if (existing && !existing.deletedAt) {
      throw AppError.conflict('Already in favorites');
    }

    if (existing && existing.deletedAt) {
      return prisma.favorite.update({
        where: { id: existing.id },
        data: { deletedAt: null, notes },
      });
    }

    const favorite = await prisma.favorite.create({
      data: { userId, favoriteId, notes },
    });

    logInfo(`User ${userId} favorited ${favoriteId}`);
    return favorite;
  }

  // ============================================
  // 2. REMOVE FAVORITE
  // ============================================
  static async removeFavorite(userId, favoriteId) {
    const favorite = await prisma.favorite.findFirst({
      where: { userId, favoriteId, deletedAt: null },
    });
    if (!favorite) throw AppError.notFound('Favorite not found');

    return prisma.favorite.update({
      where: { id: favorite.id },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================
  // 3. GET MY FAVORITES
  // ============================================
  static async getMyFavorites(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId, deletedAt: null },
        include: {
          favorite: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              role: true,
              isOnline: true,
              lastSeen: true,
              girl: {
                select: { isOnline: true, rating: true, isVerified: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.favorite.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      data: favorites,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. CHECK FAVORITE
  // ============================================
  static async isFavorite(userId, favoriteId) {
    const count = await prisma.favorite.count({
      where: { userId, favoriteId, deletedAt: null },
    });
    return count > 0;
  }

  // ============================================
  // 5. GET COUNT
  // ============================================
  static async getCount(userId) {
    return prisma.favorite.count({ where: { userId, deletedAt: null } });
  }

  // ============================================
  // 6. UPDATE NOTES
  // ============================================
  static async updateNotes(userId, favoriteId, notes) {
    const favorite = await prisma.favorite.findFirst({
      where: { userId, favoriteId, deletedAt: null },
    });
    if (!favorite) throw AppError.notFound('Favorite not found');

    return prisma.favorite.update({
      where: { id: favorite.id },
      data: { notes },
    });
  }
}

module.exports = FavoriteService;