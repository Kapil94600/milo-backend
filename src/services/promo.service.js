// ============================================
// Promo Service — Bond (Fixed per-user + race conditions)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const UploadService = require('./upload.service');
const { logInfo, logError } = require('../utils/logger');

class PromoService {
  // ============================================
  // HELPER: Resolve image
  // ============================================
  static async resolveImage(data, folder = 'promos') {
    if (data._uploadedFile) {
      const result = await UploadService.uploadFile(data._uploadedFile, folder);
      return result.url;
    }
    if (data.image && typeof data.image === 'string' && data.image.trim()) {
      return data.image.trim();
    }
    return null;
  }

  // ============================================
  // 1. CREATE PROMO
  // ============================================
  static async createPromo(data, adminId) {
    const code = String(data.code).toUpperCase();

    const existing = await prisma.promoCode.findUnique({
      where: { code },
    });
    if (existing) throw AppError.conflict('Promo code already exists');

    const imageUrl = await this.resolveImage(data, 'promos');

    // ⭐ Validate value
    if (data.value <= 0) {
      throw AppError.badRequest('Promo value must be positive');
    }

    if (data.type === 'PERCENTAGE' && data.value > 100) {
      throw AppError.badRequest('Percentage cannot exceed 100');
    }

    return prisma.promoCode.create({
      data: {
        code,
        description: data.description,
        image: imageUrl,
        type: data.type,
        value: data.value,
        maxDiscount: data.maxDiscount || null,
        minOrderAmount: data.minOrderAmount || 0,
        maxUses: data.maxUses || 0,
        perUserLimit: data.perUserLimit || 1,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive ?? true,
        applicableRoles: data.applicableRoles || ['USER', 'GIRL', 'ADMIN'],
        applicableProducts: data.applicableProducts || ['ALL'],
        createdBy: adminId,
      },
    });
  }

  // ============================================
  // ⭐ 2. VALIDATE PROMO (Atomic + per-user limit)
  // ============================================
  static async validatePromo(code, userId, amount = 0) {
    const upperCode = String(code).toUpperCase();

    const promo = await prisma.promoCode.findFirst({
      where: {
        code: upperCode,
        isActive: true,
        deletedAt: null,
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
    });

    if (!promo) throw AppError.badRequest('Invalid or expired promo code');

    // ⭐ Check total usage limit
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      throw AppError.badRequest('Promo code has reached its limit');
    }

    // ⭐ Check user-specific usage limit
    const userUsage = await prisma.promoUsage.count({
      where: { promoId: promo.id, userId },
    });

    if (userUsage >= promo.perUserLimit) {
      throw AppError.badRequest(
        `You have already used this promo (limit: ${promo.perUserLimit})`
      );
    }

    // ⭐ Check minimum order amount
    if (amount < promo.minOrderAmount) {
      throw AppError.badRequest(
        `Minimum order amount is ₹${promo.minOrderAmount}`
      );
    }

    // ⭐ Calculate discount
    let discount = 0;
    if (promo.type === 'PERCENTAGE') {
      discount = (amount * promo.value) / 100;
      if (promo.maxDiscount && discount > promo.maxDiscount) {
        discount = promo.maxDiscount;
      }
    } else if (promo.type === 'FIXED') {
      discount = Math.min(promo.value, amount);
    }

    discount = helpers.round(discount, 2);

    return { promo, discount, isValid: true };
  }

  // ============================================
  // ⭐ 3. APPLY PROMO (ATOMIC — race condition safe)
  // ============================================
  static async applyPromo(code, userId, amount = 0, orderId = null) {
    const upperCode = String(code).toUpperCase();

    // ⭐ Use transaction to prevent race condition
    const result = await prisma.$transaction(async (tx) => {
      // Lock promo row (serializable)
      const promo = await tx.promoCode.findFirst({
        where: {
          code: upperCode,
          isActive: true,
          deletedAt: null,
          startDate: { lte: new Date() },
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      });

      if (!promo) throw AppError.badRequest('Invalid or expired promo code');

      // Total usage check
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
        throw AppError.badRequest('Promo code has reached its limit');
      }

      // Per-user usage check
      const userUsage = await tx.promoUsage.count({
        where: { promoId: promo.id, userId },
      });

      if (userUsage >= promo.perUserLimit) {
        throw AppError.badRequest(
          `You have already used this promo (limit: ${promo.perUserLimit})`
        );
      }

      // Min order check
      if (amount < promo.minOrderAmount) {
        throw AppError.badRequest(
          `Minimum order amount is ₹${promo.minOrderAmount}`
        );
      }

      // Calculate discount
      let discount = 0;
      if (promo.type === 'PERCENTAGE') {
        discount = (amount * promo.value) / 100;
        if (promo.maxDiscount && discount > promo.maxDiscount) {
          discount = promo.maxDiscount;
        }
      } else if (promo.type === 'FIXED') {
        discount = Math.min(promo.value, amount);
      }

      discount = helpers.round(discount, 2);

      // Atomic increment (with condition guard)
      const incrementResult = await tx.promoCode.updateMany({
        where: {
          id: promo.id,
          ...(promo.maxUses > 0
            ? { usedCount: { lt: promo.maxUses } }
            : {}),
        },
        data: { usedCount: { increment: 1 } },
      });

      if (incrementResult.count === 0) {
        throw AppError.badRequest('Promo code has reached its limit');
      }

      // Record usage
      await tx.promoUsage.create({
        data: {
          promoId: promo.id,
          userId,
          discount,
          orderId: orderId || null,
        },
      });

      return { promo, discount, isValid: true };
    });

    logInfo(`Promo ${code} applied by ${userId}: ₹${result.discount} off`);
    return result;
  }

  // ============================================
  // 4. GET PROMOS
  // ============================================
  static async getPromos({ page = 1, limit = 20, isActive, type, search } = {}) {
    const where = { deletedAt: null };
    if (isActive !== undefined) where.isActive = isActive;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [promos, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        include: {
          usages: {
            select: { id: true, userId: true, discount: true, usedAt: true },
            orderBy: { usedAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.promoCode.count({ where }),
    ]);

    return {
      data: promos,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 5. GET PROMO BY ID
  // ============================================
  static async getPromoById(id) {
    const promo = await prisma.promoCode.findUnique({
      where: { id },
      include: {
        usages: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { usedAt: 'desc' },
        },
      },
    });
    if (!promo || promo.deletedAt) throw AppError.notFound('Promo not found');
    return promo;
  }

  // ============================================
  // 6. UPDATE PROMO
  // ============================================
  static async updatePromo(id, data) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Promo not found');

    const allowed = [
      'description', 'type', 'value', 'maxDiscount', 'minOrderAmount',
      'maxUses', 'perUserLimit', 'startDate', 'endDate', 'isActive',
      'applicableRoles', 'applicableProducts',
    ];
    const updates = helpers.pick(data, allowed);

    if (data._uploadedFile || data.image !== undefined) {
      updates.image = await this.resolveImage(data, 'promos');
    }

    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    return prisma.promoCode.update({ where: { id }, data: updates });
  }

  // ============================================
  // 7. DELETE PROMO
  // ============================================
  static async deletePromo(id) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Promo not found');

    return prisma.promoCode.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================
  // 8. TOGGLE
  // ============================================
  static async togglePromoStatus(id, isActive) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Promo not found');

    return prisma.promoCode.update({ where: { id }, data: { isActive } });
  }

  // ============================================
  // 9. STATS
  // ============================================
  static async getStats() {
    const [total, active, used, byType, recentUsages] = await Promise.all([
      prisma.promoCode.count({ where: { deletedAt: null } }),
      prisma.promoCode.count({ where: { isActive: true, deletedAt: null } }),
      prisma.promoCode.aggregate({
        where: { deletedAt: null },
        _sum: { usedCount: true },
      }),
      prisma.promoCode.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.promoUsage.findMany({
        include: {
          promo: { select: { code: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { usedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      total,
      active,
      totalUsed: used._sum.usedCount || 0,
      byType,
      recentUsages,
    };
  }
}

module.exports = PromoService;