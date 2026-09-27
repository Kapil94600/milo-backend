// ============================================
// Girl Service — Complete (with file upload support)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const UploadService = require('./upload.service');
const NotificationService = require('./notification.service');
const { logInfo } = require('../utils/logger');
const {
  ROLES,
  Status,
  VerificationStatus,
  GirlRequestStatus,
} = require('../common/enums');

class GirlService {
  // ============================================
  // HELPER: Resolve file OR url (required)
  // ============================================
  static async resolveRequiredFile(data, field = '_uploadedFile', folder = 'verification', errorMsg = 'File is required') {
    // 1. If file uploaded (multipart)
    if (data[field]) {
      const result = await UploadService.uploadFile(data[field], folder);
      return result.url;
    }

    // 2. If URL string provided
    if (data.url && typeof data.url === 'string' && data.url.trim()) {
      return data.url.trim();
    }

    // 3. Missing
    throw AppError.badRequest(errorMsg);
  }

  // ============================================
  // HELPER: Resolve file OR url (optional)
  // ============================================
  static async resolveOptionalFile(data, field = '_uploadedFile', folder = 'girls') {
    if (data[field]) {
      const result = await UploadService.uploadFile(data[field], folder);
      return result.url;
    }
    if (data.url && typeof data.url === 'string' && data.url.trim()) {
      return data.url.trim();
    }
    return null;
  }

  // ============================================
  // SELF — Submit Girl Registration Request
  // ============================================
  static async submitGirlRequest(userId, data) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    // Check if already a girl
    if (user.role === ROLES.GIRL) {
      throw AppError.conflict('You are already a registered girl');
    }

    // Validate required data
    if (!data.about || data.about.trim().length < 20) {
      throw AppError.badRequest(
        'Please write at least 20 characters about yourself'
      );
    }

    if (!data.categories || data.categories.length === 0) {
      throw AppError.badRequest('Please select at least one category');
    }

    if (!data.languages || data.languages.length === 0) {
      throw AppError.badRequest('Please select at least one language');
    }

    // Check existing request
    const existing = await prisma.girlRequest.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === GirlRequestStatus.PENDING) {
        throw AppError.conflict('Your request is already pending approval');
      }

      // Update rejected request → re-submit
      const updated = await prisma.girlRequest.update({
        where: { userId },
        data: {
          about: data.about.trim(),
          categories: data.categories || [],
          languages: data.languages || [],
          specialties: data.specialties || [],
          hourlyRate: data.hourlyRate || 100,
          status: GirlRequestStatus.PENDING,
          rejectionReason: null,
          reviewedById: null,
          reviewedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              profileImage: true,
            },
          },
        },
      });

      logInfo(`Girl request re-submitted: ${userId}`);
      return updated;
    }

    // Create new request
    const request = await prisma.girlRequest.create({
      data: {
        userId,
        about: data.about.trim(),
        categories: data.categories || [],
        languages: data.languages || [],
        specialties: data.specialties || [],
        hourlyRate: data.hourlyRate || 100,
        status: GirlRequestStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
          },
        },
      },
    });

    logInfo(`Girl request submitted: ${userId}`);
    return request;
  }

  // ============================================
  // SELF — Get My Request Status
  // ============================================
  static async getMyGirlRequest(userId) {
    return prisma.girlRequest.findUnique({
      where: { userId },
    });
  }

  // ============================================
  // ADMIN — Get All Requests
  // ============================================
  static async getAllGirlRequests({ page = 1, limit = 20, status } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.girlRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.girlRequest.count({ where }),
    ]);

    return {
      data: requests,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // ADMIN — Approve / Reject Request
  // ============================================
  static async processGirlRequest(
    requestId,
    action,
    adminId,
    rejectionReason = null
  ) {
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      throw AppError.badRequest('Action must be APPROVED or REJECTED');
    }

    const request = await prisma.girlRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw AppError.notFound('Request not found');

    if (request.status !== GirlRequestStatus.PENDING) {
      throw AppError.badRequest('Request already processed');
    }

    // Update request
    const updated = await prisma.girlRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        rejectionReason: action === 'REJECTED' ? rejectionReason : null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    // If approved → create girl profile + update user role
    if (action === 'APPROVED') {
      const existingGirl = await prisma.girl.findUnique({
        where: { userId: request.userId },
      });

      if (!existingGirl) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: request.userId },
            data: { role: ROLES.GIRL, isVerified: true },
          });

          await tx.girl.create({
            data: {
              userId: request.userId,
              isOnline: false,
              isAvailable: true,
              acceptChat: true,
              acceptCalls: true,
              isVerified: true,
              categories: request.categories,
              languages: request.languages,
              specialties: request.specialties,
              about: request.about,
              hourlyRate: request.hourlyRate,
              status: Status.ACTIVE,
            },
          });
        });

        // Send notification
        try {
          await NotificationService.sendGirlRequestNotification(
            request.userId,
            'APPROVED'
          );
        } catch (e) {
          logInfo('Notification failed but approval succeeded');
        }

        logInfo(`Girl request approved: ${request.userId}`);
      }
    } else {
      // Rejected → send notification
      try {
        await NotificationService.sendGirlRequestNotification(
          request.userId,
          'REJECTED',
          rejectionReason
        );
      } catch (e) {
        logInfo('Notification failed but rejection succeeded');
      }
    }

    return updated;
  }

  // ============================================
  // ADMIN — Create Girl (direct)
  // ============================================
  static async createGirlProfile(data) {
    const { userId, phone, name, email, ...girlData } = data;

    let user;

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else if (phone) {
      user = await prisma.user.findUnique({ where: { phone } });
    }

    if (!user && phone) {
      user = await prisma.user.create({
        data: {
          phone,
          name: name || `Girl_${phone.slice(-4)}`,
          email: email || null,
          role: ROLES.GIRL,
          isVerified: true,
          isActive: true,
          wallet: { create: { balance: 0, coins: 0 } },
        },
      });
    }

    if (!user) throw AppError.badRequest('User ID or phone required');

    const existing = await prisma.girl.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      throw AppError.conflict('Girl profile already exists');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: ROLES.GIRL },
    });

    const girl = await prisma.girl.create({
      data: {
        userId: user.id,
        isOnline: false,
        isAvailable: true,
        acceptChat: true,
        acceptCalls: true,
        isVerified: girlData.isVerified ?? true,
        categories: girlData.categories || [],
        languages: girlData.languages || [],
        specialties: girlData.specialties || [],
        about: girlData.about || null,
        hourlyRate: girlData.hourlyRate || 100,
        status: Status.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });

    return girl;
  }

  // ============================================
  // SELF — Create My Profile (Direct — Deprecated)
  // ============================================
  static async createMyProfile(userId, data) {
    return this.submitGirlRequest(userId, data);
  }

  // ============================================
  // Get by ID
  // ============================================
  static async getGirlById(girlId) {
    const girl = await prisma.girl.findUnique({
      where: { id: girlId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            city: true,
            country: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
    });
    if (!girl) throw AppError.notFound('Girl profile not found');
    return girl;
  }

  // ============================================
  // Get by User ID
  // ============================================
  static async getGirlByUserId(userId) {
    const girl = await prisma.girl.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profileImage: true,
            city: true,
            country: true,
          },
        },
      },
    });
    if (!girl) throw AppError.notFound('Girl profile not found');
    return girl;
  }

  // ============================================
  // Get My Profile
  // ============================================
  static async getMyProfile(userId) {
    return this.getGirlByUserId(userId);
  }

  // ============================================
  // Update My Profile
  // ============================================
  static async updateMyProfile(userId, data) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    const allowed = [
      'isAvailable',
      'acceptChat',
      'acceptCalls',
      'categories',
      'languages',
      'specialties',
      'about',
      'hourlyRate',
      'instagramUrl',
      'youtubeUrl',
      'twitterUrl',
    ];
    const updates = helpers.pick(data, allowed);

    return prisma.girl.update({
      where: { userId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });
  }

  // ============================================
  // Update Online Status
  // ============================================
  static async updateOnlineStatus(userId, isOnline) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    const [updated] = await prisma.$transaction([
      prisma.girl.update({ where: { userId }, data: { isOnline } }),
      prisma.user.update({
        where: { id: userId },
        data: { isOnline, lastSeen: new Date() },
      }),
    ]);

    return updated;
  }

  // ============================================
  // Update Availability
  // ============================================
  static async updateAvailability(userId, isAvailable) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    return prisma.girl.update({
      where: { userId },
      data: { isAvailable },
    });
  }

  // ============================================
  // Upload Verification Docs — WITH FILE UPLOAD SUPPORT
  // ============================================
  static async uploadVerificationDocs(userId, data) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    // Resolve ID proof (file OR url)
    const idProofUrl = await this.resolveRequiredFile(
      {
        _uploadedFile: data.idProofFile,
        url: data.idProofUrl,
      },
      '_uploadedFile',
      'verification',
      'ID proof is required (file or URL)'
    );

    // Resolve selfie (file OR url)
    const selfieUrl = await this.resolveRequiredFile(
      {
        _uploadedFile: data.selfieFile,
        url: data.selfieUrl,
      },
      '_uploadedFile',
      'verification',
      'Selfie is required (file or URL)'
    );

    return prisma.girl.update({
      where: { userId },
      data: {
        idProofUrl,
        selfieUrl,
        verificationStatus: VerificationStatus.PENDING,
        isVerified: false,
      },
    });
  }

  // ============================================
  // Get Available Girls
  // ============================================
  static async getAvailableGirls({
    page = 1,
    limit = 20,
    category,
    language,
    search,
    minRating,
  } = {}) {
    const where = {
      status: Status.ACTIVE,
      deletedAt: null,
      isVerified: true,
    };

    if (category) where.categories = { has: category };
    if (language) where.languages = { has: language };
    if (minRating) where.rating = { gte: parseFloat(minRating) };

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
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
              profileImage: true,
              city: true,
              isOnline: true,
            },
          },
        },
        orderBy: [{ rating: 'desc' }, { earningsTotal: 'desc' }],
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

  // ============================================
  // Get Top Girls
  // ============================================
  static async getTopGirls(limit = 10) {
    return prisma.girl.findMany({
      where: {
        status: Status.ACTIVE,
        isVerified: true,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            city: true,
            isOnline: true,
          },
        },
      },
      orderBy: [{ rating: 'desc' }, { earningsTotal: 'desc' }],
      take: limit,
    });
  }

  // ============================================
  // Get All Girls (Admin)
  // ============================================
  static async getAllGirls({
    page = 1,
    limit = 20,
    search,
    isVerified,
    status,
  } = {}) {
    const where = { deletedAt: null };
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (status) where.status = status;

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
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

  // ============================================
  // Verify Girl
  // ============================================
  static async verifyGirl(girlId, status) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw AppError.badRequest('Status must be APPROVED or REJECTED');
    }

    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    return prisma.girl.update({
      where: { id: girlId },
      data: {
        verificationStatus: status,
        isVerified: status === 'APPROVED',
      },
    });
  }

  // ============================================
  // Update Girl (Admin)
  // ============================================
  static async updateGirlById(girlId, data) {
    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    const allowed = [
      'isAvailable',
      'isOnline',
      'acceptChat',
      'acceptCalls',
      'isVerified',
      'isFeatured',
      'categories',
      'languages',
      'specialties',
      'about',
      'hourlyRate',
      'status',
    ];
    const updates = helpers.pick(data, allowed);

    return prisma.girl.update({
      where: { id: girlId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
          },
        },
      },
    });
  }

  // ============================================
  // Delete Girl (Admin)
  // ============================================
  static async deleteGirl(girlId) {
    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    await prisma.$transaction(async (tx) => {
      await tx.girl.update({
        where: { id: girlId },
        data: {
          status: Status.DELETED,
          isOnline: false,
          isAvailable: false,
          deletedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: girl.userId },
        data: { role: ROLES.USER },
      });
    });

    return { message: 'Girl profile deleted' };
  }

  // ============================================
  // Delete My Profile (Self)
  // ============================================
  static async deleteMyProfile(userId) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    return this.deleteGirl(girl.id);
  }

  // ============================================
  // Update Earnings
  // ============================================
  static async updateEarnings(userId, amount) {
    return prisma.girl.update({
      where: { userId },
      data: {
        earningsTotal: { increment: amount },
        earningsToday: { increment: amount },
        earningsThisWeek: { increment: amount },
        earningsThisMonth: { increment: amount },
        totalCoinsEarned: { increment: amount },
      },
    });
  }

  // ============================================
  // Update Stats
  // ============================================
  static async updateStats(userId, stats) {
    return prisma.girl.update({
      where: { userId },
      data: {
        totalCalls: stats.totalCalls
          ? { increment: stats.totalCalls }
          : undefined,
        totalVoiceMins: stats.totalVoiceMinutes
          ? { increment: stats.totalVoiceMinutes }
          : undefined,
        totalVideoMins: stats.totalVideoMinutes
          ? { increment: stats.totalVideoMinutes }
          : undefined,
        totalMessages: stats.totalMessages
          ? { increment: stats.totalMessages }
          : undefined,
      },
    });
  }
}

module.exports = GirlService;