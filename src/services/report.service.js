// ============================================
// Report Service
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');
const { ReportStatus } = require('../common/enums');

class ReportService {
  // ============================================
  // 1. CREATE REPORT
  // ============================================
  static async createReport(reporterId, data) {
    const {
      reportedId,
      type,
      category,
      description,
      evidence = [],
      priority = 'MEDIUM',
      ip,
      userAgent,
    } = data;

    if (reporterId === reportedId) {
      throw AppError.badRequest('Cannot report yourself');
    }

    const reported = await prisma.user.findUnique({ where: { id: reportedId } });
    if (!reported) throw AppError.notFound('Reported user not found');

    const existing = await prisma.report.findFirst({
      where: {
        reporterId,
        reportedId,
        status: { in: ['PENDING', 'REVIEWED'] },
        deletedAt: null,
      },
    });
    if (existing) {
      throw AppError.conflict('You have already reported this user');
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedId,
        type,
        category,
        description,
        evidence,
        priority,
        status: ReportStatus.PENDING,
        ipAddress: ip,
        userAgent,
      },
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        reported: { select: { id: true, name: true, phone: true } },
      },
    });

    logInfo(`Report created: ${report.id}`);
    return report;
  }

  // ============================================
  // 2. GET REPORTS (admin)
  // ============================================
  static async getReports({ page = 1, limit = 20, status, type, category, priority } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;
    if (type) where.type = type;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, phone: true, profileImage: true } },
          reported: { select: { id: true, name: true, phone: true, profileImage: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 3. GET REPORT BY ID
  // ============================================
  static async getReportById(reportId, userId) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        reported: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!report) throw AppError.notFound('Report not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';
    const isInvolved = report.reporterId === userId || report.reportedId === userId;

    if (!isAdmin && !isInvolved) throw AppError.forbidden('Not authorized');

    return report;
  }

  // ============================================
  // 4. UPDATE REPORT STATUS
  // ============================================
  static async updateReportStatus(reportId, adminId, data) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw AppError.notFound('Report not found');

    const updates = {
      status: data.status,
      reviewedById: adminId,
      reviewedAt: new Date(),
    };

    if (data.resolution) updates.resolution = data.resolution;
    if (data.resolutionAction) updates.resolutionAction = data.resolutionAction;
    if (data.assignedToId) updates.assignedToId = data.assignedToId;
    if (data.priority) updates.priority = data.priority;
    if (data.adminNotes) updates.adminNotes = data.adminNotes;

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: updates,
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        reported: { select: { id: true, name: true, phone: true } },
      },
    });

    // Take action if resolved
    if (data.status === 'RESOLVED' && data.resolutionAction) {
      const action = data.resolutionAction;
      if (action === 'BAN') {
        await prisma.user.update({
          where: { id: report.reportedId },
          data: { isActive: false, status: 'BLOCKED' },
        });
      } else if (action === 'SUSPEND') {
        await prisma.user.update({
          where: { id: report.reportedId },
          data: { isActive: false, status: 'INACTIVE' },
        });
      }
    }

    return updated;
  }

  // ============================================
  // 5. DELETE REPORT
  // ============================================
  static async deleteReport(reportId) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw AppError.notFound('Report not found');

    return prisma.report.update({
      where: { id: reportId },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================
  // 6. GET MY REPORTS
  // ============================================
  static async getMyReports(userId) {
    return prisma.report.findMany({
      where: {
        OR: [{ reporterId: userId }, { reportedId: userId }],
        deletedAt: null,
      },
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        reported: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================
  // 7. GET STATS
  // ============================================
  static async getStats() {
    const [total, pending, resolved, rejected, byCategory, byPriority] = await Promise.all([
      prisma.report.count({ where: { deletedAt: null } }),
      prisma.report.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.report.count({ where: { status: 'RESOLVED', deletedAt: null } }),
      prisma.report.count({ where: { status: 'REJECTED', deletedAt: null } }),
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
    ]);

    return { total, pending, resolved, rejected, byCategory, byPriority };
  }
}

module.exports = ReportService;