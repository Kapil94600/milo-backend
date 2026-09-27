// ============================================
// Maintenance Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');
const { invalidateMaintenanceCache } = require('../middleware/maintenance');

class MaintenanceService {
  // ============================================
  // 1. GET STATUS (current)
  // ============================================
  static async getStatus() {
    const record = await prisma.maintenance.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return {
        isEnabled: false,
        message: 'We are currently under maintenance. Please try again later.',
        type: 'SCHEDULED',
        affectedServices: ['ALL'],
      };
    }

    return record;
  }

  // ============================================
  // 2. ENABLE
  // ============================================
  static async enable(message, adminId, options = {}) {
    const { type = 'SCHEDULED', scheduledStart, scheduledEnd, affectedServices } = options;

    const record = await prisma.maintenance.create({
      data: {
        isEnabled: true,
        message: message || 'We are currently under maintenance. Please try again later.',
        type,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        startedAt: new Date(),
        affectedServices: affectedServices || ['ALL'],
        updatedBy: adminId,
      },
    });

    // Invalidate cache
    await invalidateMaintenanceCache();

    logInfo(`Maintenance mode ENABLED by ${adminId}`);
    return record;
  }

  // ============================================
  // 3. DISABLE
  // ============================================
  static async disable(adminId) {
    const current = await this.getStatus();
    if (!current.isEnabled) {
      throw AppError.badRequest('Maintenance mode is not enabled');
    }

    const record = await prisma.maintenance.create({
      data: {
        isEnabled: false,
        message: current.message,
        type: current.type,
        startedAt: current.startedAt,
        endedAt: new Date(),
        affectedServices: current.affectedServices,
        updatedBy: adminId,
      },
    });

    await invalidateMaintenanceCache();

    logInfo(`Maintenance mode DISABLED by ${adminId}`);
    return record;
  }

  // ============================================
  // 4. UPDATE MESSAGE ONLY
  // ============================================
  static async updateMessage(message, adminId) {
    const current = await this.getStatus();
    if (!current.id) {
      throw AppError.notFound('No maintenance record found');
    }

    const record = await prisma.maintenance.update({
      where: { id: current.id },
      data: {
        message,
        updatedBy: adminId,
      },
    });

    await invalidateMaintenanceCache();

    logInfo(`Maintenance message updated by ${adminId}`);
    return record;
  }

  // ============================================
  // 5. HISTORY (admin)
  // ============================================
  static async getHistory({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.maintenance.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.maintenance.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: records,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }
}

module.exports = MaintenanceService;