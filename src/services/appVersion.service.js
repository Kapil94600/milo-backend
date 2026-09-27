// ============================================
// App Version Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');

class AppVersionService {
  // ============================================
  // Compare versions
  // ============================================
  static compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  // ============================================
  // 1. CREATE VERSION (admin)
  // ============================================
  static async createVersion(data) {
    // If isLatest, unset others for this platform
    if (data.isLatest) {
      await prisma.appVersion.updateMany({
        where: { platform: data.platform },
        data: { isLatest: false },
      });
    }

    return prisma.appVersion.create({ data });
  }

  // ============================================
  // 2. GET LATEST VERSION
  // ============================================
  static async getLatestVersion(platform) {
    const version = await prisma.appVersion.findFirst({
      where: { platform, isLatest: true, deletedAt: null },
    });
    if (!version) throw AppError.notFound('No version found');
    return version;
  }

  // ============================================
  // 3. GET ALL VERSIONS
  // ============================================
  static async getAllVersions({ page = 1, limit = 20, platform } = {}) {
    const where = { deletedAt: null };
    if (platform) where.platform = platform;

    const skip = (page - 1) * limit;

    const [versions, total] = await Promise.all([
      prisma.appVersion.findMany({
        where,
        orderBy: { releasedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.appVersion.count({ where }),
    ]);

    return {
      data: versions,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. CHECK VERSION (main API)
  // ============================================
  static async checkVersion(platform, currentVersion) {
    try {
      const latest = await this.getLatestVersion(platform);
      const comparison = this.compareVersions(currentVersion, latest.version);

      return {
        isLatest: comparison >= 0,
        needsUpdate: comparison < 0,
        isMandatory: latest.isMandatory && comparison < 0,
        latestVersion: latest.version,
        minVersion: latest.minVersion,
        requiredVersion: latest.requiredVersion,
        downloadUrl: latest.downloadUrl,
        releaseNotes: latest.releaseNotes,
      };
    } catch (error) {
      return {
        isLatest: true,
        needsUpdate: false,
        isMandatory: false,
        latestVersion: currentVersion,
      };
    }
  }

  // ============================================
  // 5. UPDATE VERSION
  // ============================================
  static async updateVersion(id, data) {
    const existing = await prisma.appVersion.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Version not found');

    if (data.isLatest) {
      await prisma.appVersion.updateMany({
        where: { platform: existing.platform },
        data: { isLatest: false },
      });
    }

    return prisma.appVersion.update({ where: { id }, data });
  }

  // ============================================
  // 6. DELETE VERSION (soft)
  // ============================================
  static async deleteVersion(id) {
    const existing = await prisma.appVersion.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Version not found');

    return prisma.appVersion.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

module.exports = AppVersionService;