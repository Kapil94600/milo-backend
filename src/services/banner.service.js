// ============================================
// Banner Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const UploadService = require('./upload.service');
const { logInfo } = require('../utils/logger');

class BannerService {
  // ============================================
  // HELPER: Resolve image URL (from file OR url)
  // ============================================
  static async resolveImage(data, folder = 'banners') {
    // 1. If file uploaded (multipart), use it
    if (data._uploadedFile) {
      console.log('✅ [Banner] Using uploaded file:', data._uploadedFile.filename);
      const result = await UploadService.uploadFile(data._uploadedFile, folder);
      return result.url;
    }

    // 2. If image URL provided directly
    if (data.image && typeof data.image === 'string' && data.image.trim()) {
      console.log('✅ [Banner] Using image URL:', data.image);
      return data.image.trim();
    }

    // 3. Both missing
    console.log('❌ [Banner] No file and no image URL');
    throw AppError.badRequest('Banner image is required (URL or file upload)');
  }

  // ============================================
  // 1. CREATE BANNER
  // ============================================
  static async createBanner(data, adminId) {
    console.log('🔨 [Banner] Creating banner with data:', {
      title: data.title,
      hasFile: !!data._uploadedFile,
      hasImageUrl: !!data.image,
    });

    const imageUrl = await this.resolveImage(data, 'banners');

    return prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        image: imageUrl,
        linkType: data.linkType || 'NONE',
        link: data.link || null,
        linkData: data.linkData || null,
        position: data.position || 0,
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        platform: data.platform || ['ALL'],
        roles: data.roles || ['ALL'],
        createdBy: adminId,
      },
    });
  }

  // ============================================
  // 2. GET ACTIVE BANNERS (public)
  // ============================================
  static async getActiveBanners({ platform = 'ALL', role = 'USER' } = {}) {
    const now = new Date();

    return prisma.banner.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        platform: { hasSome: [platform, 'ALL'] },
        roles: { hasSome: [role, 'ALL'] },
      },
      orderBy: [{ displayOrder: 'asc' }, { position: 'asc' }],
    });
  }

  // ============================================
  // 3. GET ALL BANNERS (admin)
  // ============================================
  static async getAllBanners({ page = 1, limit = 20, isActive, search } = {}) {
    const where = { deletedAt: null };
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subtitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [banners, total] = await Promise.all([
      prisma.banner.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.banner.count({ where }),
    ]);

    return {
      data: banners,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. GET BANNER BY ID
  // ============================================
  static async getBannerById(id) {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner || banner.deletedAt) throw AppError.notFound('Banner not found');
    return banner;
  }

  // ============================================
  // 5. UPDATE BANNER (with file upload support)
  // ============================================
  static async updateBanner(id, data, adminId) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Banner not found');

    const allowed = [
      'title',
      'subtitle',
      'linkType',
      'link',
      'linkData',
      'position',
      'displayOrder',
      'isActive',
      'isFeatured',
      'startDate',
      'endDate',
      'platform',
      'roles',
    ];
    const updates = helpers.pick(data, allowed);
    updates.updatedBy = adminId;

    // Handle image (file OR url)
    if (data._uploadedFile || data.image) {
      updates.image = await this.resolveImage(data, 'banners');
    }

    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    return prisma.banner.update({ where: { id }, data: updates });
  }

  // ============================================
  // 6. DELETE BANNER (soft)
  // ============================================
  static async deleteBanner(id) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Banner not found');

    return prisma.banner.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================
  // 7. TOGGLE STATUS
  // ============================================
  static async toggleBanner(id, isActive) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Banner not found');

    return prisma.banner.update({ where: { id }, data: { isActive } });
  }

  // ============================================
  // 8. REORDER
  // ============================================
  static async reorderBanners(orders) {
    await Promise.all(
      orders.map((o) =>
        prisma.banner.update({
          where: { id: o.id },
          data: { displayOrder: o.displayOrder },
        })
      )
    );
    return { message: 'Banners reordered' };
  }

  // ============================================
  // 9. TRACK CLICK / VIEW
  // ============================================
  static async trackClick(id) {
    return prisma.banner.update({
      where: { id },
      data: { clickCount: { increment: 1 } },
    });
  }

  static async trackView(id) {
    return prisma.banner.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  // ============================================
  // 10. STATS
  // ============================================
  static async getStats() {
    const [total, active, totalClicks, totalViews] = await Promise.all([
      prisma.banner.count({ where: { deletedAt: null } }),
      prisma.banner.count({ where: { isActive: true, deletedAt: null } }),
      prisma.banner.aggregate({ _sum: { clickCount: true } }),
      prisma.banner.aggregate({ _sum: { viewCount: true } }),
    ]);

    return {
      total,
      active,
      totalClicks: totalClicks._sum.clickCount || 0,
      totalViews: totalViews._sum.viewCount || 0,
    };
  }
}

module.exports = BannerService;