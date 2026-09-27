// ============================================
// Admin Service — Dashboard + Management
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

    // ✅ FIX: don't mutate `now` with setHours — create a new date
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
      },
      timestamp: new Date(),
    };
  }

  // ... rest of AdminService unchanged (getUserGrowth, getRecentActivities, etc.)
  // ============================================
  // 2. USER GROWTH (chart data)
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

    // Group by date
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
    const [recentUsers, recentCalls, recentGifts, recentTransactions] = await Promise.all([
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

    // Merge & sort by date
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
      'specialties', 'about', 'hourlyRate', 'status',
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
    const [totalCoins, totalBalance, totalEarned, totalWithdrawn, pendingWithdrawals] = await Promise.all([
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

    const settings = await prisma.setting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return settings;
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
          type: typeof value === 'number' ? 'NUMBER'
              : typeof value === 'boolean' ? 'BOOLEAN'
              : Array.isArray(value) ? 'ARRAY'
              : typeof value === 'object' ? 'OBJECT'
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
  // 10. ADMIN MANAGEMENT
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
  // 11. ANALYTICS
  // ============================================
  static async getAnalytics(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const [newUsers, activeUsers, calls, messages, gifts, revenue] = await Promise.all([
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
}

module.exports = AdminService;