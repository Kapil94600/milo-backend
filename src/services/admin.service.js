// ============================================
// Admin Service — Bond (Complete + Clean)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');

class AdminService {
  // ============================================
  // 1. DASHBOARD STATS
  // ============================================
  static async getDashboardStats() {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalGirls,
      totalAdmins,
      activeUsers7d,
      onlineUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      totalCalls,
      totalMessages,
      totalGifts,
      totalTransactions,
      totalRevenue,
      totalCoins,
      pendingReports,
      pendingTickets,
      pendingWithdrawals,
      pendingRateChanges,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER', deletedAt: null } }),
      prisma.user.count({ where: { role: 'GIRL', deletedAt: null } }),
      prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
      prisma.user.count({
        where: { lastLogin: { gte: last7Days }, deletedAt: null },
      }),
      prisma.user.count({ where: { isOnline: true, deletedAt: null } }),
      prisma.user.count({
        where: { createdAt: { gte: todayStart }, deletedAt: null },
      }),
      prisma.user.count({ where: { createdAt: { gte: last7Days }, deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: last30Days }, deletedAt: null } }),
      prisma.call.count({ where: { status: 'ENDED' } }),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.giftTransaction.count({ where: { status: 'COMPLETED' } }),
      prisma.transaction.count({ where: { deletedAt: null } }),
      prisma.transaction.aggregate({
        where: { type: 'CREDIT', status: 'COMPLETED', deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.wallet.aggregate({
        _sum: { coins: true },
      }),
      prisma.report.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'OPEN', deletedAt: null } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.girl.count({ where: { rateApproved: false, deletedAt: null } }),
    ]);

    return {
      users: {
        total: totalUsers,
        girls: totalGirls,
        admins: totalAdmins,
        active7d: activeUsers7d,
        online: onlineUsers,
        newToday: newUsersToday,
        new7d: newUsers7d,
        new30d: newUsers30d,
      },
      activity: {
        totalCalls,
        totalMessages,
        totalGifts,
        totalTransactions,
      },
      finance: {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalCoinsInCirculation: totalCoins._sum.coins || 0,
      },
      pending: {
        reports: pendingReports,
        tickets: pendingTickets,
        withdrawals: pendingWithdrawals,
        rateChanges: pendingRateChanges,
      },
      timestamp: new Date(),
    };
  }

  // ============================================
  // 2. USER GROWTH
  // ============================================
  static async getUserGrowth(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate },
        deletedAt: null,
      },
      select: { createdAt: true },
    });

    const grouped = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      grouped[key] = 0;
    }

    users.forEach((u) => {
      const key = u.createdAt.toISOString().split('T')[0];
      if (grouped[key] !== undefined) grouped[key]++;
    });

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }

  // ============================================
  // 3. RECENT ACTIVITIES
  // ============================================
  static async getRecentActivities(limit = 20) {
    const [recentUsers, recentCalls, recentGifts, recentTransactions] =
      await Promise.all([
        prisma.user.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, role: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.call.findMany({
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            caller: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.giftTransaction.findMany({
          select: {
            id: true,
            coins: true,
            createdAt: true,
            gift: { select: { name: true } },
            sender: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.transaction.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            type: true,
            category: true,
            amount: true,
            coins: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ]);

    const activities = [
      ...recentUsers.map((u) => ({
        type: 'USER_REGISTERED',
        timestamp: u.createdAt,
        data: u,
      })),
      ...recentCalls.map((c) => ({
        type: 'CALL',
        timestamp: c.createdAt,
        data: c,
      })),
      ...recentGifts.map((g) => ({
        type: 'GIFT_SENT',
        timestamp: g.createdAt,
        data: g,
      })),
      ...recentTransactions.map((t) => ({
        type: 'TRANSACTION',
        timestamp: t.createdAt,
        data: t,
      })),
    ];

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return activities.slice(0, limit);
  }

  // ============================================
  // 4. REVENUE STATS
  // ============================================
  static async getRevenueStats(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [total, coinPurchase, subscription, byDate] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: 'CREDIT',
          status: 'COMPLETED',
          deletedAt: null,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          category: 'COIN_PURCHASE',
          status: 'COMPLETED',
          deletedAt: null,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          category: 'SUBSCRIPTION',
          status: 'COMPLETED',
          deletedAt: null,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: {
          type: 'CREDIT',
          status: 'COMPLETED',
          deletedAt: null,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      total: total._sum.amount || 0,
      coinPurchases: coinPurchase._sum.amount || 0,
      subscriptions: subscription._sum.amount || 0,
      byCategory: byDate,
    };
  }

  // ============================================
  // 5. TOP PERFORMERS
  // ============================================
  static async getTopGirls(limit = 10) {
    return prisma.girl.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      include: {
        user: { select: { id: true, name: true, profileImage: true } },
      },
      orderBy: [{ earningsTotal: 'desc' }, { rating: 'desc' }],
      take: limit,
    });
  }

  static async getTopUsers(limit = 10) {
    return prisma.user.findMany({
      where: { role: 'USER', deletedAt: null },
      select: {
        id: true,
        name: true,
        profileImage: true,
        totalSpent: true,
        totalCoins: true,
      },
      orderBy: { totalSpent: 'desc' },
      take: limit,
    });
  }

  // ============================================
  // 6. USER MANAGEMENT
  // ============================================
  static async getUsers({ page = 1, limit = 20, search, role, status } = {}) {
    const where = { deletedAt: null };
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          email: true,
          name: true,
          role: true,
          status: true,
          isActive: true,
          isOnline: true,
          isVerified: true,
          profileImage: true,
          totalCoins: true,
          totalSpent: true,
          createdAt: true,
          lastLogin: true,
          lastSeen: true,
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

  static async getUserDetail(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        girl: true,
        admin: true,
      },
    });

    if (!user) throw AppError.notFound('User not found');

    const [recentTransactions, recentCalls, recentGifts] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.call.findMany({
        where: { OR: [{ callerId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          caller: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      }),
      prisma.giftTransaction.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          gift: { select: { name: true } },
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      }),
    ]);

    const { password, refreshToken, ...safeUser } = user;
    return {
      ...safeUser,
      recentTransactions,
      recentCalls,
      recentGifts,
    };
  }

  static async updateUserStatus(userId, { isActive, status }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    const updates = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (status) updates.status = status;

    return prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, name: true, isActive: true, status: true },
    });
  }

  static async blockUser(userId, reason = null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    return prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        isOnline: false,
        status: 'BLOCKED',
        refreshToken: null,
      },
      select: { id: true, name: true, status: true },
    });
  }

  static async unblockUser(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    return prisma.user.update({
      where: { id: userId },
      data: { isActive: true, status: 'ACTIVE' },
      select: { id: true, name: true, status: true },
    });
  }

  static async deleteUser(userId) {
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
        data: { status: 'DELETED', deletedAt: new Date() },
      });
    });

    return { message: 'User deleted' };
  }

  // ============================================
  // 7. GIRL MANAGEMENT
  // ============================================
  static async getGirls({ page = 1, limit = 20, search, isVerified, status } = {}) {
    const where = { deletedAt: null };
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const skip = (page - 1) * limit;

    const [girls, total] = await Promise.all([
      prisma.girl.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              profileImage: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.girl.count({ where }),
    ]);

    return {
      data: girls,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  static async verifyGirl(girlId, status, adminId) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw AppError.badRequest('Status must be APPROVED or REJECTED');
    }

    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl not found');

    return prisma.girl.update({
      where: { id: girlId },
      data: {
        verificationStatus: status,
        isVerified: status === 'APPROVED',
      },
    });
  }

  static async updateGirl(girlId, data) {
    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl not found');

    const allowed = [
      'isAvailable', 'isOnline', 'acceptChat', 'acceptCalls',
      'isVerified', 'isFeatured', 'categories', 'languages',
      'specialties', 'about', 'hourlyRate', 'videoCallRate',
      'chatMessageRate', 'rateApproved', 'status',
    ];
    const updates = helpers.pick(data, allowed);

    return prisma.girl.update({
      where: { id: girlId },
      data: updates,
      include: {
        user: { select: { id: true, name: true, phone: true, profileImage: true } },
      },
    });
  }

  static async deleteGirl(girlId) {
    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl not found');

    await prisma.$transaction(async (tx) => {
      await tx.girl.update({
        where: { id: girlId },
        data: {
          status: 'DELETED',
          isOnline: false,
          isAvailable: false,
          deletedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: girl.userId },
        data: { role: 'USER' },
      });
    });

    return { message: 'Girl deleted' };
  }

  // ============================================
  // 8. WALLET MANAGEMENT
  // ============================================
  static async getWalletStats() {
    const [
      totalCoins,
      totalBalance,
      totalEarned,
      totalWithdrawn,
      pendingWithdrawals,
    ] = await Promise.all([
      prisma.wallet.aggregate({ _sum: { coins: true } }),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.wallet.aggregate({ _sum: { totalEarned: true } }),
      prisma.wallet.aggregate({ _sum: { totalWithdrawn: true } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      totalCoinsInCirculation: totalCoins._sum.coins || 0,
      totalBalance: totalBalance._sum.balance || 0,
      totalEarned: totalEarned._sum.totalEarned || 0,
      totalWithdrawn: totalWithdrawn._sum.totalWithdrawn || 0,
      pendingWithdrawals,
    };
  }

  static async getTransactions({ page = 1, limit = 20, type, category, userId } = {}) {
    const where = { deletedAt: null };
    if (type) where.type = type;
    if (category) where.category = category;
    if (userId) where.userId = userId;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  static async getWithdrawals({ page = 1, limit = 20, status } = {}) {
    const where = {};
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawal.count({ where }),
    ]);

    return {
      data: withdrawals,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 9. SETTINGS MANAGEMENT
  // ============================================
  static async getSettings(category = null) {
    const where = { deletedAt: null };
    if (category) where.category = category;

    return prisma.setting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  static async getSetting(key) {
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (!setting) throw AppError.notFound('Setting not found');
    return setting;
  }

  static async updateSetting(key, value, adminId) {
    const setting = await prisma.setting.findUnique({ where: { key } });

    if (!setting) {
      return prisma.setting.create({
        data: {
          key,
          value,
          type:
            typeof value === 'number'
              ? 'NUMBER'
              : typeof value === 'boolean'
              ? 'BOOLEAN'
              : Array.isArray(value)
              ? 'ARRAY'
              : typeof value === 'object'
              ? 'OBJECT'
              : 'STRING',
          category: 'GENERAL',
          updatedBy: adminId,
        },
      });
    }

    return prisma.setting.update({
      where: { key },
      data: { value, updatedBy: adminId },
    });
  }

  static async createSetting(data, adminId) {
    return prisma.setting.create({
      data: {
        ...data,
        updatedBy: adminId,
      },
    });
  }

  static async deleteSetting(key) {
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (!setting) throw AppError.notFound('Setting not found');

    return prisma.setting.update({
      where: { key },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================
  // ⭐ 10. RATE MANAGEMENT (CONSOLIDATED)
  // ============================================
  static async getPendingRateChanges({ page = 1, limit = 20 } = {}) {
    const GirlService = require('./girl.service');
    return GirlService.getPendingRateChanges({ page, limit });
  }

  static async processRateChange(girlId, action, adminId) {
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      throw AppError.badRequest('Action must be APPROVED or REJECTED');
    }

    const GirlService = require('./girl.service');
    const updated = await GirlService.approveRateChange(girlId, action);

    logInfo(`Rate change ${action} for girl ${girlId} by admin ${adminId}`);
    return updated;
  }

  static async updateGlobalRates({
    messageCost,
    mediaCost,
    girlEarningPercent,
    voiceCallRate,
    videoCallRate,
    platformCommission,
    minCoinsForVideo,
  }) {
    const updates = [];

    if (messageCost !== undefined) {
      if (messageCost < 0) throw AppError.badRequest('Message cost cannot be negative');
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CHAT_MESSAGE_COST' },
          update: { value: messageCost },
          create: {
            key: 'CHAT_MESSAGE_COST',
            value: messageCost,
            type: 'NUMBER',
            category: 'COINS',
            description: 'Default cost per text message in coins',
          },
        })
      );
    }

    if (mediaCost !== undefined) {
      if (mediaCost < 0) throw AppError.badRequest('Media cost cannot be negative');
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CHAT_MEDIA_COST' },
          update: { value: mediaCost },
          create: {
            key: 'CHAT_MEDIA_COST',
            value: mediaCost,
            type: 'NUMBER',
            category: 'COINS',
            description: 'Default cost per media message',
          },
        })
      );
    }

    if (girlEarningPercent !== undefined) {
      if (girlEarningPercent < 0 || girlEarningPercent > 100) {
        throw AppError.badRequest('Girl earning percent must be 0-100');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CHAT_GIRL_EARNING_PERCENT' },
          update: { value: girlEarningPercent },
          create: {
            key: 'CHAT_GIRL_EARNING_PERCENT',
            value: girlEarningPercent,
            type: 'NUMBER',
            category: 'COINS',
            description: '% of message coins girl receives',
          },
        })
      );
    }

    if (voiceCallRate !== undefined) {
      if (voiceCallRate < 0) throw AppError.badRequest('Voice rate cannot be negative');
      updates.push(
        prisma.setting.upsert({
          where: { key: 'COIN_VOICE_COST_PER_MINUTE' },
          update: { value: voiceCallRate },
          create: {
            key: 'COIN_VOICE_COST_PER_MINUTE',
            value: voiceCallRate,
            type: 'NUMBER',
            category: 'COINS',
            description: 'Default voice call rate per minute (fallback)',
          },
        })
      );
    }

    if (videoCallRate !== undefined) {
      if (videoCallRate < 0) throw AppError.badRequest('Video rate cannot be negative');
      updates.push(
        prisma.setting.upsert({
          where: { key: 'COIN_VIDEO_COST_PER_MINUTE' },
          update: { value: videoCallRate },
          create: {
            key: 'COIN_VIDEO_COST_PER_MINUTE',
            value: videoCallRate,
            type: 'NUMBER',
            category: 'COINS',
            description: 'Default video call rate per minute (fallback)',
          },
        })
      );
    }

    if (platformCommission !== undefined) {
      if (platformCommission < 0 || platformCommission > 100) {
        throw AppError.badRequest('Platform commission must be 0-100');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CALL_PLATFORM_COMMISSION' },
          update: { value: platformCommission },
          create: {
            key: 'CALL_PLATFORM_COMMISSION',
            value: platformCommission,
            type: 'NUMBER',
            category: 'CALLS',
            description: 'Platform commission % from call earnings',
          },
        })
      );
    }

    if (minCoinsForVideo !== undefined) {
      if (minCoinsForVideo < 0) throw AppError.badRequest('Min coins cannot be negative');
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CALL_MIN_COINS_FOR_VIDEO' },
          update: { value: minCoinsForVideo },
          create: {
            key: 'CALL_MIN_COINS_FOR_VIDEO',
            value: minCoinsForVideo,
            type: 'NUMBER',
            category: 'CALLS',
            description: 'Minimum coins required for video calls',
          },
        })
      );
    }

    await Promise.all(updates);

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'CHAT_MESSAGE_COST',
            'CHAT_MEDIA_COST',
            'CHAT_GIRL_EARNING_PERCENT',
            'COIN_VOICE_COST_PER_MINUTE',
            'COIN_VIDEO_COST_PER_MINUTE',
            'CALL_PLATFORM_COMMISSION',
            'CALL_MIN_COINS_FOR_VIDEO',
          ],
        },
      },
    });

    const result = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    logInfo('Global rates updated by admin');
    return result;
  }

  static async getGlobalRates() {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'CHAT_MESSAGE_COST',
            'CHAT_MEDIA_COST',
            'CHAT_GIRL_EARNING_PERCENT',
            'COIN_VOICE_COST_PER_MINUTE',
            'COIN_VIDEO_COST_PER_MINUTE',
            'CALL_PLATFORM_COMMISSION',
            'CALL_MIN_COINS_FOR_VIDEO',
          ],
        },
      },
    });

    const result = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    return {
      chatMessageCost: result.CHAT_MESSAGE_COST || 1,
      chatMediaCost: result.CHAT_MEDIA_COST || 5,
      girlEarningPercent: result.CHAT_GIRL_EARNING_PERCENT || 50,
      defaultVoiceRate: result.COIN_VOICE_COST_PER_MINUTE || 10,
      defaultVideoRate: result.COIN_VIDEO_COST_PER_MINUTE || 20,
      platformCommission: result.CALL_PLATFORM_COMMISSION || 50,
      minCoinsForVideo: result.CALL_MIN_COINS_FOR_VIDEO || 50,
    };
  }

  // ============================================
  // 11. ADMIN MANAGEMENT
  // ============================================
  static async getAllAdmins() {
    return prisma.admin.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profileImage: true,
            isActive: true,
            lastLogin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateAdmin(adminId, data) {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw AppError.notFound('Admin not found');

    const allowed = [
      'role',
      'canManageUsers', 'canManageGirls', 'canManageCoins',
      'canManagePayments', 'canManageSubscriptions', 'canManageSettings',
      'canManageReports', 'canManageNotifications', 'canViewAnalytics',
      'canManageAdmins',
    ];
    const updates = helpers.pick(data, allowed);

    return prisma.admin.update({
      where: { id: adminId },
      data: updates,
    });
  }

  static async removeAdmin(adminId, currentAdminId) {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw AppError.notFound('Admin not found');

    if (admin.userId === currentAdminId) {
      throw AppError.badRequest('Cannot remove yourself');
    }

    if (admin.role === 'SUPER_ADMIN') {
      throw AppError.forbidden('Cannot remove super admin');
    }

    await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { id: adminId },
        data: { deletedAt: new Date(), status: 'DELETED' },
      });

      await tx.user.update({
        where: { id: admin.userId },
        data: { role: 'USER' },
      });
    });

    return { message: 'Admin removed' };
  }

  static async getAdminLoginHistory(adminId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      prisma.adminLoginHistory.findMany({
        where: { adminId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminLoginHistory.count({ where: { adminId } }),
    ]);

    return {
      data: history,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 12. ANALYTICS
  // ============================================
  static async getAnalytics(startDate, endDate) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const [newUsers, activeUsers, calls, messages, gifts, revenue] =
      await Promise.all([
        prisma.user.count({
          where: { createdAt: { gte: start, lte: end }, deletedAt: null },
        }),
        prisma.user.count({
          where: { lastLogin: { gte: start, lte: end }, deletedAt: null },
        }),
        prisma.call.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.message.count({
          where: { createdAt: { gte: start, lte: end }, deletedAt: null },
        }),
        prisma.giftTransaction.count({
          where: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
        }),
        prisma.transaction.aggregate({
          where: {
            type: 'CREDIT',
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
      ]);

    return {
      period: { start, end },
      newUsers,
      activeUsers,
      calls,
      messages,
      gifts,
      revenue: revenue._sum.amount || 0,
    };
  }

  // ============================================
  // ⭐ 13. PAYOUT RATES
  // ============================================
  static async getPayoutRates() {
    const [rate, percent, minWithdrawal, feePercent] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'COIN_TO_RUPEE_RATE' } }),
      prisma.setting.findUnique({ where: { key: 'GIRL_PAYOUT_PERCENT' } }),
      prisma.setting.findUnique({ where: { key: 'COIN_WITHDRAW_LIMIT' } }),
      prisma.setting.findUnique({ where: { key: 'WITHDRAWAL_FEE_PERCENT' } }),
    ]);

    return {
      coinToRupeeRate: Number(rate?.value) || 1,
      girlPayoutPercent: Number(percent?.value) || 70,
      minWithdrawalAmount: Number(minWithdrawal?.value) || 100,
      withdrawalFeePercent: Number(feePercent?.value) || 2,
    };
  }

  static async updatePayoutRates({
    coinToRupeeRate,
    girlPayoutPercent,
    minWithdrawalAmount,
    withdrawalFeePercent,
  }) {
    const updates = [];

    if (coinToRupeeRate !== undefined) {
      if (coinToRupeeRate <= 0) {
        throw AppError.badRequest('Coin to rupee rate must be positive');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'COIN_TO_RUPEE_RATE' },
          update: { value: coinToRupeeRate },
          create: {
            key: 'COIN_TO_RUPEE_RATE',
            value: coinToRupeeRate,
            type: 'NUMBER',
            category: 'PAYOUT',
            description: 'Coin to Rupee conversion rate',
          },
        })
      );
    }

    if (girlPayoutPercent !== undefined) {
      if (girlPayoutPercent < 0 || girlPayoutPercent > 100) {
        throw AppError.badRequest('Payout percent must be 0-100');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'GIRL_PAYOUT_PERCENT' },
          update: { value: girlPayoutPercent },
          create: {
            key: 'GIRL_PAYOUT_PERCENT',
            value: girlPayoutPercent,
            type: 'NUMBER',
            category: 'PAYOUT',
            description: '% of coins girl gets as ₹',
          },
        })
      );
    }

    if (minWithdrawalAmount !== undefined) {
      if (minWithdrawalAmount < 0) {
        throw AppError.badRequest('Min withdrawal amount cannot be negative');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'COIN_WITHDRAW_LIMIT' },
          update: { value: minWithdrawalAmount },
          create: {
            key: 'COIN_WITHDRAW_LIMIT',
            value: minWithdrawalAmount,
            type: 'NUMBER',
            category: 'PAYOUT',
            description: 'Minimum withdrawal amount',
          },
        })
      );
    }

    if (withdrawalFeePercent !== undefined) {
      if (withdrawalFeePercent < 0 || withdrawalFeePercent > 100) {
        throw AppError.badRequest('Fee percent must be 0-100');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'WITHDRAWAL_FEE_PERCENT' },
          update: { value: withdrawalFeePercent },
          create: {
            key: 'WITHDRAWAL_FEE_PERCENT',
            value: withdrawalFeePercent,
            type: 'NUMBER',
            category: 'PAYOUT',
            description: 'Withdrawal fee %',
          },
        })
      );
    }

    await Promise.all(updates);

    logInfo('Payout rates updated by admin');
    return this.getPayoutRates();
  }

  // ============================================
  // ⭐ 14. DASHBOARD CHARTS
  // ============================================
  static async getRevenueChart(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await prisma.transaction.findMany({
      where: {
        type: 'CREDIT',
        status: 'COMPLETED',
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        amount: true,
        coins: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      grouped[key] = { date: key, amount: 0, coins: 0, count: 0 };
    }

    transactions.forEach((t) => {
      const key = t.createdAt.toISOString().split('T')[0];
      if (grouped[key]) {
        grouped[key].amount += t.amount || 0;
        grouped[key].coins += t.coins || 0;
        grouped[key].count += 1;
      }
    });

    return Object.values(grouped);
  }

  static async getCallsChart(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const calls = await prisma.call.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        type: true,
        status: true,
        duration: true,
        cost: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      grouped[key] = {
        date: key,
        total: 0,
        voice: 0,
        video: 0,
        ended: 0,
        missed: 0,
        totalDuration: 0,
        totalCost: 0,
      };
    }

    calls.forEach((c) => {
      const key = c.createdAt.toISOString().split('T')[0];
      if (grouped[key]) {
        grouped[key].total += 1;
        if (c.type === 'VOICE') grouped[key].voice += 1;
        if (c.type === 'VIDEO') grouped[key].video += 1;
        if (c.status === 'ENDED') grouped[key].ended += 1;
        if (c.status === 'MISSED') grouped[key].missed += 1;
        grouped[key].totalDuration += c.duration || 0;
        grouped[key].totalCost += c.cost || 0;
      }
    });

    return Object.values(grouped);
  }

  // ⭐ User Activity Timeline
  static async getUserActivity(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) throw AppError.notFound('User not found');

    const [transactions, calls, gifts, messages, reports] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          category: true,
          coins: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.call.findMany({
        where: { OR: [{ callerId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          duration: true,
          cost: true,
          callerId: true,
          receiverId: true,
          createdAt: true,
        },
      }),
      prisma.giftTransaction.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          gift: { select: { name: true } },
        },
      }),
      prisma.message.count({
        where: { senderId: userId, deletedAt: null },
      }),
      prisma.report.findMany({
        where: { OR: [{ reporterId: userId }, { reportedId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const timeline = [
      ...transactions.map((t) => ({
        type: 'TRANSACTION',
        timestamp: t.createdAt,
        data: t,
      })),
      ...calls.map((c) => ({
        type: 'CALL',
        timestamp: c.createdAt,
        data: c,
      })),
      ...gifts.map((g) => ({
        type: 'GIFT',
        timestamp: g.createdAt,
        data: g,
      })),
      ...reports.map((r) => ({
        type: 'REPORT',
        timestamp: r.createdAt,
        data: r,
      })),
    ];

    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      user,
      stats: {
        totalTransactions: transactions.length,
        totalCalls: calls.length,
        totalGifts: gifts.length,
        totalMessages: messages,
        totalReports: reports.length,
      },
      timeline: timeline.slice(0, 50),
    };
  }
    // ============================================
  // ⭐ 15. ANALYTICS — GIFTS (NEW)
  // ============================================
  static async getGiftAnalytics({ days = 30 } = {}) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalTransactions,
      completedTransactions,
      coinsSpent,
      byCategory,
      byRarity,
      topGifts,
      recentTransactions,
      dailyTrend,
    ] = await Promise.all([
      prisma.giftTransaction.count({ where: { createdAt: { gte: startDate } } }),
      prisma.giftTransaction.count({
        where: { status: 'COMPLETED', createdAt: { gte: startDate } },
      }),
      prisma.giftTransaction.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startDate } },
        _sum: { coins: true, price: true },
      }),
      prisma.gift.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.gift.groupBy({
        by: ['rarity'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.gift.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { totalSent: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          image: true,
          coins: true,
          price: true,
          totalSent: true,
          category: true,
          rarity: true,
        },
      }),
      prisma.giftTransaction.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          gift: { select: { name: true } },
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      }),
      // Daily trend
      prisma.giftTransaction.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, coins: true, price: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group daily trend
    const groupedTrend = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      groupedTrend[key] = { date: key, count: 0, coins: 0, amount: 0 };
    }

    dailyTrend.forEach((t) => {
      const key = t.createdAt.toISOString().split('T')[0];
      if (groupedTrend[key]) {
        groupedTrend[key].count += 1;
        groupedTrend[key].coins += t.coins || 0;
        groupedTrend[key].amount += t.price || 0;
      }
    });

    return {
      period: { days },
      totalTransactions,
      completedTransactions,
      totalCoinsSpent: coinsSpent._sum.coins || 0,
      totalMoneySpent: coinsSpent._sum.price || 0,
      byCategory,
      byRarity,
      topGifts,
      recentTransactions,
      dailyTrend: Object.values(groupedTrend),
    };
  }

  // ============================================
  // ⭐ 16. ANALYTICS — SUBSCRIPTIONS (NEW)
  // ============================================
  static async getSubscriptionAnalytics({ days = 30 } = {}) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalPlans,
      activePlans,
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue,
      byPlan,
      recentSubscriptions,
      dailyTrend,
    ] = await Promise.all([
      prisma.subscriptionPlan.count({ where: { deletedAt: null } }),
      prisma.subscriptionPlan.count({ where: { isActive: true, deletedAt: null } }),
      prisma.subscription.count({ where: { deletedAt: null } }),
      prisma.subscription.count({
        where: { isActive: true, endDate: { gt: new Date() }, deletedAt: null },
      }),
      prisma.subscription.count({
        where: { endDate: { lt: new Date() }, deletedAt: null },
      }),
      prisma.subscription.count({
        where: { autoRenew: false, cancelledAt: { not: null }, deletedAt: null },
      }),
      prisma.subscription.aggregate({
        where: { paymentStatus: 'COMPLETED', createdAt: { gte: startDate } },
        _sum: { amount: true },
      }),
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { deletedAt: null },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.subscription.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          plan: { select: { id: true, name: true, price: true } },
        },
      }),
      prisma.subscription.findMany({
        where: { createdAt: { gte: startDate }, deletedAt: null },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Get plan names
    const planIds = byPlan.map((b) => b.planId);
    const plans = await prisma.subscriptionPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true, price: true },
    });
    const planMap = {};
    plans.forEach((p) => (planMap[p.id] = p));

    const byPlanEnriched = byPlan.map((b) => ({
      planId: b.planId,
      planName: planMap[b.planId]?.name || 'Unknown',
      planPrice: planMap[b.planId]?.price || 0,
      count: b._count._all,
      revenue: b._sum.amount || 0,
    }));

    // Daily trend
    const groupedTrend = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      groupedTrend[key] = { date: key, count: 0, revenue: 0 };
    }

    dailyTrend.forEach((s) => {
      const key = s.createdAt.toISOString().split('T')[0];
      if (groupedTrend[key]) {
        groupedTrend[key].count += 1;
        groupedTrend[key].revenue += s.amount || 0;
      }
    });

    return {
      period: { days },
      totalPlans,
      activePlans,
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue: totalRevenue._sum.amount || 0,
      byPlan: byPlanEnriched,
      recentSubscriptions,
      dailyTrend: Object.values(groupedTrend),
    };
  }

  // ============================================
  // ⭐ 17. ANALYTICS — REPORTS (NEW)
  // ============================================
  static async getReportAnalytics({ days = 30 } = {}) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      total,
      pending,
      reviewed,
      resolved,
      rejected,
      byType,
      byCategory,
      byPriority,
      recentReports,
      dailyTrend,
      avgResolutionTime,
    ] = await Promise.all([
      prisma.report.count({ where: { deletedAt: null } }),
      prisma.report.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.report.count({ where: { status: 'REVIEWED', deletedAt: null } }),
      prisma.report.count({ where: { status: 'RESOLVED', deletedAt: null } }),
      prisma.report.count({ where: { status: 'REJECTED', deletedAt: null } }),
      prisma.report.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.report.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.report.groupBy({
        by: ['priority'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.report.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          reporter: { select: { id: true, name: true, profileImage: true } },
          reported: { select: { id: true, name: true, profileImage: true } },
        },
      }),
      prisma.report.findMany({
        where: { createdAt: { gte: startDate }, deletedAt: null },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.report.findMany({
        where: {
          status: { in: ['RESOLVED', 'REJECTED'] },
          reviewedAt: { not: null },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, reviewedAt: true },
      }),
    ]);

    // Daily trend
    const groupedTrend = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      groupedTrend[key] = {
        date: key,
        total: 0,
        pending: 0,
        resolved: 0,
        rejected: 0,
      };
    }

    dailyTrend.forEach((r) => {
      const key = r.createdAt.toISOString().split('T')[0];
      if (groupedTrend[key]) {
        groupedTrend[key].total += 1;
        if (r.status === 'PENDING') groupedTrend[key].pending += 1;
        if (r.status === 'RESOLVED') groupedTrend[key].resolved += 1;
        if (r.status === 'REJECTED') groupedTrend[key].rejected += 1;
      }
    });

    // Avg resolution time
    let avgHours = 0;
    if (avgResolutionTime.length > 0) {
      const totalMs = avgResolutionTime.reduce((acc, r) => {
        return acc + (new Date(r.reviewedAt) - new Date(r.createdAt));
      }, 0);
      avgHours = totalMs / avgResolutionTime.length / (1000 * 60 * 60);
    }

    return {
      period: { days },
      total,
      pending,
      reviewed,
      resolved,
      rejected,
      byType,
      byCategory,
      byPriority,
      avgResolutionHours: Math.round(avgHours * 10) / 10,
      recentReports,
      dailyTrend: Object.values(groupedTrend),
    };
  }

  // ============================================
  // ⭐ 18. ANALYTICS — SUPPORT (NEW)
  // ============================================
  static async getSupportAnalytics({ days = 30 } = {}) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      total,
      open,
      inProgress,
      resolved,
      closed,
      reopened,
      byCategory,
      byPriority,
      avgRating,
      recentTickets,
      dailyTrend,
      avgResponseTime,
    ] = await Promise.all([
      prisma.supportTicket.count({ where: { deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'OPEN', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'REOPENED', deletedAt: null } }),
      prisma.supportTicket.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.supportTicket.groupBy({
        by: ['priority'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.supportTicket.aggregate({
        where: { rating: { not: null } },
        _avg: { rating: true },
      }),
      prisma.supportTicket.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.supportTicket.findMany({
        where: { createdAt: { gte: startDate }, deletedAt: null },
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.supportTicket.findMany({
        where: {
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { not: null },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    // Daily trend
    const groupedTrend = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      groupedTrend[key] = {
        date: key,
        total: 0,
        open: 0,
        resolved: 0,
      };
    }

    dailyTrend.forEach((t) => {
      const key = t.createdAt.toISOString().split('T')[0];
      if (groupedTrend[key]) {
        groupedTrend[key].total += 1;
        if (t.status === 'OPEN') groupedTrend[key].open += 1;
        if (t.status === 'RESOLVED') groupedTrend[key].resolved += 1;
      }
    });

    // Avg response time
    let avgHours = 0;
    if (avgResponseTime.length > 0) {
      const totalMs = avgResponseTime.reduce((acc, t) => {
        return acc + (new Date(t.resolvedAt) - new Date(t.createdAt));
      }, 0);
      avgHours = totalMs / avgResponseTime.length / (1000 * 60 * 60);
    }

    return {
      period: { days },
      total,
      open,
      inProgress,
      resolved,
      closed,
      reopened,
      byCategory,
      byPriority,
      averageRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
      avgResponseHours: Math.round(avgHours * 10) / 10,
      recentTickets,
      dailyTrend: Object.values(groupedTrend),
    };
  }

  // ============================================
  // ⭐ 19. BULK USER ACTIONS (NEW)
  // ============================================
  static async bulkBlockUsers(userIds, reason = null) {
    if (!userIds || userIds.length === 0) {
      throw AppError.badRequest('userIds required');
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        isActive: false,
        isOnline: false,
        status: 'BLOCKED',
        refreshToken: null,
      },
    });

    logInfo(`Bulk block: ${result.count} users`);
    return { count: result.count, userIds };
  }

  static async bulkUnblockUsers(userIds) {
    if (!userIds || userIds.length === 0) {
      throw AppError.badRequest('userIds required');
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isActive: true, status: 'ACTIVE' },
    });

    logInfo(`Bulk unblock: ${result.count} users`);
    return { count: result.count, userIds };
  }

  static async bulkDeleteUsers(userIds) {
    if (!userIds || userIds.length === 0) {
      throw AppError.badRequest('userIds required');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          isActive: false,
          isOnline: false,
          status: 'DELETED',
          deletedAt: new Date(),
          refreshToken: null,
        },
      });

      await tx.device.updateMany({
        where: { userId: { in: userIds } },
        data: { isActive: false },
      });

      await tx.girl.updateMany({
        where: { userId: { in: userIds } },
        data: { status: 'DELETED', deletedAt: new Date() },
      });

      return updated;
    });

    logInfo(`Bulk delete: ${result.count} users`);
    return { count: result.count, userIds };
  }
    // ============================================
  // ⭐ 20. GENDER CHART (NEW)
  // ============================================
  static async getGenderChart() {
    const [male, female, other, preferNotToSay, unknown] = await Promise.all([
      prisma.user.count({
        where: { gender: 'MALE', deletedAt: null },
      }),
      prisma.user.count({
        where: { gender: 'FEMALE', deletedAt: null },
      }),
      prisma.user.count({
        where: { gender: 'OTHER', deletedAt: null },
      }),
      prisma.user.count({
        where: { gender: 'PREFER_NOT_TO_SAY', deletedAt: null },
      }),
      prisma.user.count({
        where: { gender: null, deletedAt: null },
      }),
    ]);

    const total = male + female + other + preferNotToSay + unknown;

    return {
      total,
      data: [
        { name: 'Male', value: male, percent: total > 0 ? Math.round((male / total) * 100) : 0 },
        { name: 'Female', value: female, percent: total > 0 ? Math.round((female / total) * 100) : 0 },
        { name: 'Other', value: other, percent: total > 0 ? Math.round((other / total) * 100) : 0 },
        { name: 'Prefer not to say', value: preferNotToSay, percent: total > 0 ? Math.round((preferNotToSay / total) * 100) : 0 },
        { name: 'Unknown', value: unknown, percent: total > 0 ? Math.round((unknown / total) * 100) : 0 },
      ],
    };
  }

  // ============================================
  // ⭐ 21. ADMIN ROLES HIERARCHY (NEW)
  // ============================================

  /**
   * Create a sub-admin with limited permissions
   */
  static async createSubAdmin(currentAdminId, data) {
    const { phone, email, name, role = 'MODERATOR', permissions = {} } = data;

    // Verify current admin is SUPER_ADMIN
    const currentAdmin = await prisma.admin.findUnique({
      where: { userId: currentAdminId },
    });

    if (!currentAdmin || currentAdmin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Only super admin can create sub-admins');
    }

    if (!helpers.isValidPhone(phone)) {
      throw AppError.badRequest('Invalid phone number');
    }
    if (!helpers.isValidEmail(email)) {
      throw AppError.badRequest('Invalid email');
    }

    const normalizedPhone = helpers.normalizePhone(phone);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone: normalizedPhone }, { email }] },
    });
    if (existing) {
      throw AppError.conflict('User with this phone or email already exists');
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: normalizedPhone,
          email,
          name,
          role: 'ADMIN',
          isVerified: true,
          isActive: true,
          wallet: { create: { balance: 0, coins: 0 } },
        },
      });

      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          role,
          canManageUsers: permissions.canManageUsers ?? false,
          canManageGirls: permissions.canManageGirls ?? false,
          canManageCoins: permissions.canManageCoins ?? false,
          canManagePayments: permissions.canManagePayments ?? false,
          canManageSubscriptions: permissions.canManageSubscriptions ?? false,
          canManageSettings: permissions.canManageSettings ?? false,
          canManageReports: permissions.canManageReports ?? true,
          canManageNotifications: permissions.canManageNotifications ?? false,
          canViewAnalytics: permissions.canViewAnalytics ?? true,
          canManageAdmins: false, // Sub-admins can NEVER manage admins
        },
      });

      return { user, admin };
    });

    logInfo(`Sub-admin created: ${normalizedPhone} (role: ${role})`);

    return {
      admin: {
        id: result.admin.id,
        role: result.admin.role,
        permissions: {
          canManageUsers: result.admin.canManageUsers,
          canManageGirls: result.admin.canManageGirls,
          canManageCoins: result.admin.canManageCoins,
          canManagePayments: result.admin.canManagePayments,
          canManageSubscriptions: result.admin.canManageSubscriptions,
          canManageSettings: result.admin.canManageSettings,
          canManageReports: result.admin.canManageReports,
          canManageNotifications: result.admin.canManageNotifications,
          canViewAnalytics: result.admin.canViewAnalytics,
          canManageAdmins: result.admin.canManageAdmins,
        },
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone,
        email: result.user.email,
      },
    };
  }

  /**
   * Get admin with permissions
   */
  static async getAdminPermissions(userId) {
    const admin = await prisma.admin.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true, profileImage: true },
        },
      },
    });

    if (!admin) throw AppError.notFound('Admin not found');

    return {
      id: admin.id,
      role: admin.role,
      permissions: {
        canManageUsers: admin.canManageUsers,
        canManageGirls: admin.canManageGirls,
        canManageCoins: admin.canManageCoins,
        canManagePayments: admin.canManagePayments,
        canManageSubscriptions: admin.canManageSubscriptions,
        canManageSettings: admin.canManageSettings,
        canManageReports: admin.canManageReports,
        canManageNotifications: admin.canManageNotifications,
        canViewAnalytics: admin.canViewAnalytics,
        canManageAdmins: admin.canManageAdmins,
      },
      user: admin.user,
    };
  }

  /**
   * Update sub-admin permissions (only super admin)
   */
  static async updateSubAdminPermissions(currentAdminId, targetAdminId, permissions) {
    // Verify current admin is SUPER_ADMIN
    const currentAdmin = await prisma.admin.findUnique({
      where: { userId: currentAdminId },
    });

    if (!currentAdmin || currentAdmin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Only super admin can update permissions');
    }

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: targetAdminId },
    });

    if (!targetAdmin) throw AppError.notFound('Admin not found');

    if (targetAdmin.role === 'SUPER_ADMIN') {
      throw AppError.forbidden('Cannot modify super admin');
    }

    const allowed = [
      'canManageUsers', 'canManageGirls', 'canManageCoins',
      'canManagePayments', 'canManageSubscriptions', 'canManageSettings',
      'canManageReports', 'canManageNotifications', 'canViewAnalytics',
    ];

    const updates = {};
    for (const key of allowed) {
      if (permissions[key] !== undefined) {
        updates[key] = permissions[key];
      }
    }

    const updated = await prisma.admin.update({
      where: { id: targetAdminId },
      data: updates,
    });

    logInfo(`Admin permissions updated: ${targetAdminId}`);
    return updated;
  }

  /**
   * Get all sub-admins (created by current admin)
   */
  static async getSubAdmins() {
    return prisma.admin.findMany({
      where: {
        role: { not: 'SUPER_ADMIN' },
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profileImage: true,
            isActive: true,
            lastLogin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = AdminService;