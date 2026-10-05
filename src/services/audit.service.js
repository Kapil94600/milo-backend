// ============================================
// Audit Service
// ============================================

const { prisma } = require('../config/database');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');

class AuditService {
  // ============================================
  // 1. LOG ACTION (fire-and-forget)
  // ============================================
  static async log({
    userId = null,
    action,
    resource,
    resourceId = null,
    changes = null,
    status = 'SUCCESS',
    error = null,
    metadata = null,
    ip = null,
    userAgent = null,
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          changes,
          status,
          error,
          metadata,
          ip,
          userAgent,
        },
      });
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // 2. QUERY LOGS (admin)
  // ============================================
  static async getLogs({
    page = 1,
    limit = 50,
    userId,
    action,
    resource,
    resourceId,
    status,
    startDate,
    endDate,
  } = {}) {
    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, phone: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 3. GET USER'S LOGS
  // ============================================
  static async getUserLogs(userId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: { userId } }),
    ]);

    return {
      data: logs,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. STATS
  // ============================================
  static async getStats() {
    const [total, byAction, byStatus, todayCount] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 20,
      }),
      prisma.auditLog.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return { total, todayCount, byAction, byStatus };
  }

  // ============================================
  // 5. CLEANUP OLD LOGS
  // ============================================
  static async cleanup(daysOld = 90) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: result.count };
  }
}

module.exports = AuditService;