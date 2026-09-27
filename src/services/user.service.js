// ============================================
// User Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const UploadService = require('./upload.service');
const { logInfo, logError } = require('../utils/logger');
const { ROLES } = require('../common/enums');

// Lazy import to avoid circular dep
const invalidateCache = async (userId) => {
  try {
    const { invalidateUserCache } = require('../middleware/auth');
    await invalidateUserCache(userId);
  } catch (e) {
    // ignore
  }
};

class UserService {
  // ============================================
  // 1. GET PROFILE (self)
  // ============================================
  static async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: {
          select: {
            balance: true,
            coins: true,
            totalEarned: true,
            totalSpent: true,
          },
        },
        girl: {
          select: {
            id: true,
            isOnline: true,
            isAvailable: true,
            isVerified: true,
            rating: true,
            totalReviews: true,
          },
        },
        girlRequest: {
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) throw AppError.notFound('User not found');

    return this.sanitizeUser(user);
  }

  // ============================================
  // 2. GET USER BY ID (public profile)
  // ============================================
  static async getUserById(userId, viewerId = null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true,
        coverImage: true,
        bio: true,
        gender: true,
        city: true,
        country: true,
        role: true,
        isOnline: true,
        lastSeen: true,
        isVerified: true,
        createdAt: true,
        girl: {
          select: {
            id: true,
            isOnline: true,
            isAvailable: true,
            isVerified: true,
            rating: true,
            totalReviews: true,
            categories: true,
            languages: true,
            specialties: true,
            about: true,
            hourlyRate: true,
          },
        },
      },
    });

    if (!user) throw AppError.notFound('User not found');

    // Check if blocked (both ways)
    if (viewerId && viewerId !== userId) {
      const blocked = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { userId: viewerId, blockedId: userId },
            { userId: userId, blockedId: viewerId },
          ],
          deletedAt: null,
        },
      });

      if (blocked) {
        throw AppError.forbidden('User not accessible');
      }
    }

    return user;
  }

  // ============================================
  // 3. UPDATE PROFILE — WITH FILE UPLOAD SUPPORT
  // ============================================
  static async updateProfile(userId, data) {
    const allowed = [
      'name',
      'email',
      'username',
      'bio',
      'birthDate',
      'gender',
      'address',
      'city',
      'country',
      'latitude',
      'longitude',
      'language',
      'darkMode',
    ];

    const updates = helpers.pick(data, allowed);

    // ─── Handle profile image (file OR url) ───
    if (data.profileImageFile) {
      const result = await UploadService.uploadFile(
        data.profileImageFile,
        'profiles'
      );
      updates.profileImage = result.url;
    } else if (data.profileImage && typeof data.profileImage === 'string') {
      updates.profileImage = data.profileImage.trim();
    }

    // ─── Handle cover image (file OR url) ───
    if (data.coverImageFile) {
      const result = await UploadService.uploadFile(
        data.coverImageFile,
        'covers'
      );
      updates.coverImage = result.url;
    } else if (data.coverImage && typeof data.coverImage === 'string') {
      updates.coverImage = data.coverImage.trim();
    }

    // ─── Validate email ───
    if (updates.email) {
      if (!helpers.isValidEmail(updates.email)) {
        throw AppError.badRequest('Invalid email address');
      }

      const existing = await prisma.user.findFirst({
        where: { email: updates.email, NOT: { id: userId } },
      });

      if (existing) throw AppError.conflict('Email already in use');
    }

    // ─── Validate username ───
    if (updates.username) {
      const existing = await prisma.user.findFirst({
        where: { username: updates.username, NOT: { id: userId } },
      });

      if (existing) throw AppError.conflict('Username already taken');
    }

    // ─── Parse birthDate ───
    if (updates.birthDate) {
      updates.birthDate = new Date(updates.birthDate);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        username: true,
        role: true,
        profileImage: true,
        coverImage: true,
        bio: true,
        birthDate: true,
        gender: true,
        city: true,
        country: true,
        language: true,
        darkMode: true,
        updatedAt: true,
      },
    });

    await invalidateCache(userId);

    logInfo(`User profile updated: ${userId}`);
    return updated;
  }

  // ============================================
  // 4. UPDATE SETTINGS
  // ============================================
  static async updateSettings(userId, data) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    const updates = {};

    if (data.language) updates.language = data.language;
    if (data.darkMode !== undefined) updates.darkMode = data.darkMode;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        language: true,
        darkMode: true,
        updatedAt: true,
      },
    });

    await invalidateCache(userId);

    return updated;
  }

  // ============================================
  // 5. DEVICE TOKEN (FCM) — Enhanced
  // ============================================
  static async addDeviceToken(
    userId,
    token,
    platform = 'unknown',
    deviceInfo = {}
  ) {
    if (!token) throw AppError.badRequest('FCM token is required');

    if (token.length < 20) {
      throw AppError.badRequest('Invalid FCM token format');
    }

    // Check if token already registered to another user
    const existing = await prisma.device.findUnique({ where: { token } });
    if (existing && existing.userId !== userId) {
      // Token belongs to someone else — reassign (logged out old user)
      await prisma.device.update({
        where: { token },
        data: { userId, isActive: true },
      });
    }

    const device = await prisma.device.upsert({
      where: { token },
      update: {
        userId,
        platform,
        deviceId: deviceInfo.deviceId || null,
        model: deviceInfo.model || null,
        version: deviceInfo.version || null,
        isActive: true,
      },
      create: {
        userId,
        token,
        platform,
        deviceId: deviceInfo.deviceId || null,
        model: deviceInfo.model || null,
        version: deviceInfo.version || null,
      },
    });

    logInfo(`Device token registered for user ${userId} (${platform})`);

    // Subscribe to broadcast topics
    try {
      const FCMService = require('./fcm.service');
      await FCMService.subscribeToTopic([token], 'all_users');
    } catch (e) {
      logError('FCM topic subscribe failed', e);
    }

    return { message: 'Device registered', device };
  }

  static async removeDeviceToken(userId, token) {
    if (!token) throw AppError.badRequest('FCM token is required');

    const result = await prisma.device.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });

    // Unsubscribe from topics
    try {
      const FCMService = require('./fcm.service');
      await FCMService.unsubscribeFromTopic([token], 'all_users');
    } catch (e) {
      logError('FCM topic unsubscribe failed', e);
    }

    return { message: 'Device removed', count: result.count };
  }

  // ============================================
  // 6. ONLINE STATUS
  // ============================================
  static async updateOnlineStatus(userId, isOnline) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
      select: {
        id: true,
        isOnline: true,
        lastSeen: true,
      },
    });

    // If user is girl, update girl status too
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (girl) {
      await prisma.girl.update({
        where: { userId },
        data: { isOnline },
      });
    }

    return user;
  }

  // ============================================
  // 7. NEARBY USERS
  // ============================================
  static async getNearbyUsers(userId, lat, lng, radiusKm = 10) {
    if (!lat || !lng)
      throw AppError.badRequest('Latitude and longitude are required');

    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
        deletedAt: null,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      select: {
        id: true,
        name: true,
        profileImage: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        isOnline: true,
        role: true,
      },
      take: 50,
    });

    const withDistance = users.map((u) => ({
      ...u,
      distanceKm: helpers.round(
        this.haversineDistance(lat, lng, u.latitude, u.longitude),
        2
      ),
    }));

    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return withDistance;
  }

  static haversineDistance(lat1, lon1, lat2, lon2) {
    if (lat2 == null || lon2 == null) return 9999;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // ============================================
  // 8. GET ALL USERS (Admin)
  // ============================================
  static async getAllUsers({
    page = 1,
    limit = 20,
    search = '',
    role = null,
    status = null,
  } = {}) {
    const where = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) where.role = role;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          email: true,
          name: true,
          username: true,
          role: true,
          status: true,
          isActive: true,
          isOnline: true,
          profileImage: true,
          totalCoins: true,
          createdAt: true,
          lastLogin: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 9. USER STATS
  // ============================================
  static async getUserStats(userId) {
    const [user, wallet, unreadNotifications, unreadGifts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalCoins: true,
          totalCalls: true,
          totalMessages: true,
          totalVoiceMins: true,
          totalVideoMins: true,
          totalReferrals: true,
        },
      }),
      prisma.wallet.findUnique({
        where: { userId },
        select: { coins: true, balance: true },
      }),
      prisma.notification.count({
        where: { userId, isRead: false, deletedAt: null },
      }),
      prisma.giftTransaction.count({
        where: { receiverId: userId, isRead: false },
      }),
    ]);

    if (!user) throw AppError.notFound('User not found');

    return {
      coins: wallet?.coins ?? 0,
      balance: wallet?.balance ?? 0,
      totalCalls: user.totalCalls,
      totalMessages: user.totalMessages,
      totalVoiceMinutes: user.totalVoiceMins,
      totalVideoMinutes: user.totalVideoMins,
      totalReferrals: user.totalReferrals,
      unreadNotifications,
      unreadGifts,
    };
  }

  // ============================================
  // 10. DELETE ACCOUNT (soft)
  // ============================================
  static async deleteAccount(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          isOnline: false,
          status: 'DELETED',
          deletedAt: new Date(),
          refreshToken: null,
        },
      });

      await tx.device.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      await tx.girl.updateMany({
        where: { userId },
        data: {
          isOnline: false,
          isAvailable: false,
          status: 'DELETED',
          deletedAt: new Date(),
        },
      });
    });

    await invalidateCache(userId);

    logInfo(`User account deleted: ${userId}`);

    return { message: 'Account deleted successfully' };
  }

  // ============================================
  // SANITIZE
  // ============================================
  static sanitizeUser(user) {
    if (!user) return null;
    const { password, refreshToken, ...safe } = user;
    return safe;
  }
}

module.exports = UserService;