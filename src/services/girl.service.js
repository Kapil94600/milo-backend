// ============================================
// Girl Service — Bond (Complete with Payout Logic)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const UploadService = require('./upload.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');
const {
  ROLES,
  Status,
  VerificationStatus,
  GirlRequestStatus,
} = require('../common/enums');

// ⭐ Rate limits
const MIN_HOURLY_RATE = 50;
const MAX_HOURLY_RATE = 5000;
const MIN_VIDEO_RATE = 100;
const MAX_VIDEO_RATE = 10000;
const MIN_CHAT_RATE = 1;
const MAX_CHAT_RATE = 50;

// ⭐ Payout conversion defaults
const DEFAULT_COIN_TO_RUPEE_RATE = 1; // 1 coin = ₹1
const DEFAULT_GIRL_PAYOUT_PERCENT = 70; // 70% of coins → ₹ balance

class GirlService {
  // ============================================
  // HELPER: Validate rates
  // ============================================
  static validateRates({ hourlyRate, videoCallRate, chatMessageRate }) {
    if (hourlyRate !== undefined) {
      const rate = Number(hourlyRate);
      if (isNaN(rate) || rate < MIN_HOURLY_RATE || rate > MAX_HOURLY_RATE) {
        throw AppError.badRequest(
          `Hourly rate must be between ₹${MIN_HOURLY_RATE} and ₹${MAX_HOURLY_RATE}`
        );
      }
    }

    if (videoCallRate !== undefined) {
      const rate = Number(videoCallRate);
      if (isNaN(rate) || rate < MIN_VIDEO_RATE || rate > MAX_VIDEO_RATE) {
        throw AppError.badRequest(
          `Video call rate must be between ₹${MIN_VIDEO_RATE} and ₹${MAX_VIDEO_RATE}`
        );
      }
    }

    if (chatMessageRate !== undefined) {
      const rate = Number(chatMessageRate);
      if (isNaN(rate) || rate < MIN_CHAT_RATE || rate > MAX_CHAT_RATE) {
        throw AppError.badRequest(
          `Chat message rate must be between ${MIN_CHAT_RATE} and ${MAX_CHAT_RATE} coins`
        );
      }
    }

    return true;
  }

  // ============================================
  // HELPER: Resolve file OR url
  // ============================================
  static async resolveRequiredFile(
    data,
    field = '_uploadedFile',
    folder = 'verification',
    errorMsg = 'File is required'
  ) {
    if (data[field]) {
      const result = await UploadService.uploadFile(data[field], folder);
      return result.url;
    }
    if (data.url && typeof data.url === 'string' && data.url.trim()) {
      return data.url.trim();
    }
    throw AppError.badRequest(errorMsg);
  }

  // ============================================
  // ⭐ HELPER: Get Payout Rate (coins → rupees)
  // ============================================
  static async getPayoutRate() {
    try {
      const [rateSetting, percentSetting] = await Promise.all([
        prisma.setting.findUnique({
          where: { key: 'COIN_TO_RUPEE_RATE' },
        }),
        prisma.setting.findUnique({
          where: { key: 'GIRL_PAYOUT_PERCENT' },
        }),
      ]);

      return {
        coinToRupeeRate:
          Number(rateSetting?.value) || DEFAULT_COIN_TO_RUPEE_RATE,
        payoutPercent:
          Number(percentSetting?.value) || DEFAULT_GIRL_PAYOUT_PERCENT,
      };
    } catch {
      return {
        coinToRupeeRate: DEFAULT_COIN_TO_RUPEE_RATE,
        payoutPercent: DEFAULT_GIRL_PAYOUT_PERCENT,
      };
    }
  }

  // ============================================
  // ⭐ Convert coins to rupees for payout
  // ============================================
  static async calculatePayout(coins) {
    const { coinToRupeeRate, payoutPercent } = await this.getPayoutRate();

    // Example: 1000 coins, rate=1, percent=70
    // → 1000 * 1 * (70/100) = ₹700
    const rupees = coins * coinToRupeeRate * (payoutPercent / 100);

    return {
      coins,
      coinToRupeeRate,
      payoutPercent,
      rupees: Math.round(rupees * 100) / 100,
    };
  }

  // ============================================
  // SELF — Submit Girl Registration Request
  // ============================================
  static async submitGirlRequest(userId, data) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    if (user.role === ROLES.GIRL) {
      throw AppError.conflict('You are already a registered girl');
    }

    if (!data.about || data.about.trim().length < 20) {
      throw AppError.badRequest('Please write at least 20 characters about yourself');
    }
    if (!data.categories || data.categories.length === 0) {
      throw AppError.badRequest('Please select at least one category');
    }
    if (!data.languages || data.languages.length === 0) {
      throw AppError.badRequest('Please select at least one language');
    }

    this.validateRates({
      hourlyRate: data.hourlyRate,
      videoCallRate: data.videoCallRate,
      chatMessageRate: data.chatMessageRate,
    });

    const existing = await prisma.girlRequest.findUnique({ where: { userId } });

    if (existing) {
      if (existing.status === GirlRequestStatus.PENDING) {
        throw AppError.conflict('Your request is already pending approval');
      }

      const updated = await prisma.girlRequest.update({
        where: { userId },
        data: {
          about: data.about.trim(),
          categories: data.categories || [],
          languages: data.languages || [],
          specialties: data.specialties || [],
          hourlyRate: Number(data.hourlyRate) || 100,
          videoCallRate: Number(data.videoCallRate) || 200,
          chatMessageRate: Number(data.chatMessageRate) || 1,
          status: GirlRequestStatus.PENDING,
          rejectionReason: null,
          reviewedById: null,
          reviewedAt: null,
        },
        include: {
          user: { select: { id: true, name: true, phone: true, profileImage: true } },
        },
      });

      logInfo(`Girl request re-submitted: ${userId}`);
      return updated;
    }

    const request = await prisma.girlRequest.create({
      data: {
        userId,
        about: data.about.trim(),
        categories: data.categories || [],
        languages: data.languages || [],
        specialties: data.specialties || [],
        hourlyRate: Number(data.hourlyRate) || 100,
        videoCallRate: Number(data.videoCallRate) || 200,
        chatMessageRate: Number(data.chatMessageRate) || 1,
        status: GirlRequestStatus.PENDING,
      },
      include: {
        user: { select: { id: true, name: true, phone: true, profileImage: true } },
      },
    });

    logInfo(`Girl request submitted: ${userId}`);
    return request;
  }

  // ============================================
  // SELF — Get My Request Status
  // ============================================
  static async getMyGirlRequest(userId) {
    return prisma.girlRequest.findUnique({ where: { userId } });
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
              id: true, name: true, phone: true, email: true, profileImage: true,
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
  static async processGirlRequest(requestId, action, adminId, rejectionReason = null) {
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

    const updated = await prisma.girlRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        rejectionReason: action === 'REJECTED' ? rejectionReason : null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

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
              videoCallRate: request.videoCallRate,
              chatMessageRate: request.chatMessageRate,
              rateApproved: true,
              status: Status.ACTIVE,
            },
          });
        });

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

    const existing = await prisma.girl.findUnique({ where: { userId: user.id } });
    if (existing) throw AppError.conflict('Girl profile already exists');

    this.validateRates(girlData);

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
        hourlyRate: Number(girlData.hourlyRate) || 100,
        videoCallRate: Number(girlData.videoCallRate) || 200,
        chatMessageRate: Number(girlData.chatMessageRate) || 1,
        rateApproved: true,
        status: Status.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true, name: true, phone: true, email: true, profileImage: true,
          },
        },
      },
    });

    return girl;
  }

  // ============================================
  // SELF — Create My Profile (Deprecated)
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
            id: true, name: true, profileImage: true, city: true, country: true,
            isOnline: true, lastSeen: true,
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
            id: true, name: true, phone: true, email: true, profileImage: true,
            city: true, country: true,
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
  // SELF — Update My Profile (with rates)
  // ============================================
  static async updateMyProfile(userId, data) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    this.validateRates(data);

    const allowed = [
      'isAvailable',
      'acceptChat',
      'acceptCalls',
      'categories',
      'languages',
      'specialties',
      'about',
      'instagramUrl',
      'youtubeUrl',
      'twitterUrl',
    ];
    const updates = helpers.pick(data, allowed);

    const rateUpdates = {};
    if (data.hourlyRate !== undefined) {
      rateUpdates.pendingHourlyRate = Number(data.hourlyRate);
    }
    if (data.videoCallRate !== undefined) {
      rateUpdates.pendingVideoRate = Number(data.videoCallRate);
    }
    if (data.chatMessageRate !== undefined) {
      rateUpdates.pendingChatRate = Number(data.chatMessageRate);
    }

    const hasRateChange =
      data.hourlyRate !== undefined ||
      data.videoCallRate !== undefined ||
      data.chatMessageRate !== undefined;

    if (hasRateChange) {
      updates.rateApproved = false;

      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true },
        });

        for (const admin of admins) {
          await NotificationService.createNotification(admin.id, {
            type: 'SYSTEM',
            title: '📊 Rate Change Request',
            body: `${girl.userId} requested a rate change`,
            data: { girlId: girl.id, userId },
            action: 'OPEN_GIRL',
            actionData: { girlId: girl.id },
            channel: 'IN_APP',
            priority: 'NORMAL',
          });
        }
      } catch (e) {
        logInfo('Rate change notification failed');
      }
    }

    return prisma.girl.update({
      where: { userId },
      data: { ...updates, ...rateUpdates },
      include: {
        user: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
  }

  // ============================================
  // ADMIN — Approve Rate Change
  // ============================================
  static async approveRateChange(girlId, action = 'APPROVED') {
    const girl = await prisma.girl.findUnique({ where: { id: girlId } });
    if (!girl) throw AppError.notFound('Girl not found');

    if (action === 'APPROVED') {
      const updates = {
        rateApproved: true,
        pendingHourlyRate: null,
        pendingVideoRate: null,
        pendingChatRate: null,
      };

      if (girl.pendingHourlyRate !== null) {
        updates.hourlyRate = girl.pendingHourlyRate;
      }
      if (girl.pendingVideoRate !== null) {
        updates.videoCallRate = girl.pendingVideoRate;
      }
      if (girl.pendingChatRate !== null) {
        updates.chatMessageRate = girl.pendingChatRate;
      }

      const updated = await prisma.girl.update({
        where: { id: girlId },
        data: updates,
      });

      try {
        await NotificationService.createNotification(girl.userId, {
          type: 'SYSTEM',
          title: '✅ Rate Change Approved',
          body: 'Your new rates have been approved',
          data: { girlId: girl.id },
          action: 'OPEN_PROFILE',
          channel: 'BOTH',
          priority: 'HIGH',
        });
      } catch (e) {}

      logInfo(`Rate change approved for girl: ${girlId}`);
      return updated;
    } else {
      const updated = await prisma.girl.update({
        where: { id: girlId },
        data: {
          rateApproved: true,
          pendingHourlyRate: null,
          pendingVideoRate: null,
          pendingChatRate: null,
        },
      });

      try {
        await NotificationService.createNotification(girl.userId, {
          type: 'SYSTEM',
          title: '❌ Rate Change Rejected',
          body: 'Your rate change request was rejected',
          data: { girlId: girl.id },
          action: 'OPEN_PROFILE',
          channel: 'BOTH',
          priority: 'HIGH',
        });
      } catch (e) {}

      logInfo(`Rate change rejected for girl: ${girlId}`);
      return updated;
    }
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
  // Upload Verification Docs
  // ============================================
  static async uploadVerificationDocs(userId, data) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    const idProofUrl = await this.resolveRequiredFile(
      { _uploadedFile: data.idProofFile, url: data.idProofUrl },
      '_uploadedFile',
      'verification',
      'ID proof is required (file or URL)'
    );

    const selfieUrl = await this.resolveRequiredFile(
      { _uploadedFile: data.selfieFile, url: data.selfieUrl },
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
  // Get Available Girls (with rate filter)
  // ============================================
  static async getAvailableGirls({
    page = 1,
    limit = 20,
    category,
    language,
    search,
    minRating,
    maxRating,
    minRate,
    maxRate,
    sortBy = 'rating',
    onlineOnly,
  } = {}) {
    const where = {
      status: Status.ACTIVE,
      deletedAt: null,
      isVerified: true,
    };

    if (category) where.categories = { has: category };
    if (language) where.languages = { has: language };
    if (minRating) where.rating = { gte: parseFloat(minRating) };
    if (maxRating) where.rating = { ...where.rating, lte: parseFloat(maxRating) };

    if (minRate || maxRate) {
      where.hourlyRate = {};
      if (minRate) where.hourlyRate.gte = parseFloat(minRate);
      if (maxRate) where.hourlyRate.lte = parseFloat(maxRate);
    }

    if (onlineOnly === 'true' || onlineOnly === true) {
      where.isOnline = true;
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    let orderBy;
    switch (sortBy) {
      case 'priceLow':
        orderBy = [{ hourlyRate: 'asc' }];
        break;
      case 'priceHigh':
        orderBy = [{ hourlyRate: 'desc' }];
        break;
      case 'earnings':
        orderBy = [{ earningsTotal: 'desc' }];
        break;
      case 'newest':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'rating':
      default:
        orderBy = [{ rating: 'desc' }, { earningsTotal: 'desc' }];
    }

    const skip = (page - 1) * limit;

    const [girls, total] = await Promise.all([
      prisma.girl.findMany({
        where,
        include: {
          user: {
            select: {
              id: true, name: true, profileImage: true, city: true, isOnline: true,
            },
          },
        },
        orderBy,
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
            id: true, name: true, profileImage: true, city: true, isOnline: true,
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
    rateApproved,
  } = {}) {
    const where = { deletedAt: null };
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (status) where.status = status;
    if (rateApproved !== undefined) where.rateApproved = rateApproved;

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
              id: true, name: true, phone: true, email: true, profileImage: true,
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

    this.validateRates(data);

    const allowed = [
      'isAvailable', 'isOnline', 'acceptChat', 'acceptCalls',
      'isVerified', 'isFeatured', 'categories', 'languages',
      'specialties', 'about', 'status', 'rateApproved',
    ];
    const updates = helpers.pick(data, allowed);

    if (data.hourlyRate !== undefined) updates.hourlyRate = Number(data.hourlyRate);
    if (data.videoCallRate !== undefined) updates.videoCallRate = Number(data.videoCallRate);
    if (data.chatMessageRate !== undefined) updates.chatMessageRate = Number(data.chatMessageRate);

    return prisma.girl.update({
      where: { id: girlId },
      data: updates,
      include: {
        user: {
          select: { id: true, name: true, phone: true, profileImage: true },
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
  // ⭐ Update Earnings (with payout conversion)
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
  // ⭐ Get Earnings Breakdown (with ₹ conversion)
  // ============================================
  static async getEarningsBreakdown(userId) {
    const girl = await prisma.girl.findUnique({ where: { userId } });
    if (!girl) throw AppError.notFound('Girl profile not found');

    const wallet = await prisma.wallet.findUnique({ where: { userId } });

    const [totalPayout, todayPayout, weekPayout, monthPayout] =
      await Promise.all([
        this.calculatePayout(girl.earningsTotal || 0),
        this.calculatePayout(girl.earningsToday || 0),
        this.calculatePayout(girl.earningsThisWeek || 0),
        this.calculatePayout(girl.earningsThisMonth || 0),
      ]);

    return {
      coins: {
        total: girl.totalCoinsEarned || 0,
        available: wallet?.coins || 0,
        earningsTotal: girl.earningsTotal || 0,
        earningsToday: girl.earningsToday || 0,
        earningsThisWeek: girl.earningsThisWeek || 0,
        earningsThisMonth: girl.earningsThisMonth || 0,
      },
      rupees: {
        total: totalPayout.rupees,
        today: todayPayout.rupees,
        thisWeek: weekPayout.rupees,
        thisMonth: monthPayout.rupees,
        balance: wallet?.balance || 0,
        pendingBalance: wallet?.pendingBalance || 0,
      },
      rate: {
        coinToRupeeRate: totalPayout.coinToRupeeRate,
        payoutPercent: totalPayout.payoutPercent,
      },
    };
  }

  // ============================================
  // Update Stats
  // ============================================
  static async updateStats(userId, stats) {
    return prisma.girl.update({
      where: { userId },
      data: {
        totalCalls: stats.totalCalls ? { increment: stats.totalCalls } : undefined,
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

  // ============================================
  // Get Girls with Pending Rate Approval (Admin)
  // ============================================
  static async getPendingRateChanges({ page = 1, limit = 20 } = {}) {
    const where = {
      rateApproved: false,
      deletedAt: null,
      OR: [
        { pendingHourlyRate: { not: null } },
        { pendingVideoRate: { not: null } },
        { pendingChatRate: { not: null } },
      ],
    };

    const skip = (page - 1) * limit;

    const [girls, total] = await Promise.all([
      prisma.girl.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, phone: true, profileImage: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
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
  // ⭐ AUTO PAYOUT (NEW)
  // ============================================

  /**
   * Get girls eligible for auto-payout
   * Criteria:
   * - isVerified
   * - earnings > minPayout
   * - lastPayoutAt > 7 days ago (or never)
   * - isActive
   */
  static async getEligibleForPayout({ minPayout = 500, days = 7 } = {}) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return prisma.girl.findMany({
      where: {
        status: 'ACTIVE',
        isVerified: true,
        deletedAt: null,
        OR: [
          { lastPayoutAt: null },
          { lastPayoutAt: { lt: cutoff } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    }).then((girls) => {
      // Filter those who have enough balance
      return girls.filter((g) => {
        const earningsInRupees = g.earningsTotal || 0;
        return earningsInRupees >= minPayout;
      });
    });
  }

  /**
   * Process auto-payout for a single girl
   * Transfers girl's `balance` (rupees) to withdrawal request
   */
  static async processAutoPayout(girlId, adminId = null) {
    const girl = await prisma.girl.findUnique({
      where: { id: girlId },
      include: { user: true },
    });

    if (!girl) throw AppError.notFound('Girl not found');
    if (girl.status !== 'ACTIVE') {
      throw AppError.badRequest('Girl is not active');
    }

    // Get wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId: girl.userId },
    });

    if (!wallet || wallet.balance <= 0) {
      return {
        success: false,
        reason: 'NO_BALANCE',
        girlId,
        balance: 0,
      };
    }

    // Get settings
    const { minAmount, feePercent } = await require('./wallet.service').getWithdrawalSettings();

    if (wallet.balance < minAmount) {
      return {
        success: false,
        reason: 'BELOW_MIN',
        girlId,
        balance: wallet.balance,
        minAmount,
      };
    }

    const amount = wallet.balance;
    const fee = Math.round((amount * feePercent) / 100 * 100) / 100;
    const netAmount = Math.round((amount - fee) * 100) / 100;

    // Create withdrawal request (auto-approved since it's system generated)
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from wallet
      const updated = await tx.wallet.updateMany({
        where: {
          userId: girl.userId,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
          pendingBalance: { increment: amount },
        },
      });

      if (updated.count === 0) {
        throw new Error('Insufficient balance');
      }

      // Create withdrawal record
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: girl.userId,
          amount,
          fee,
          netAmount,
          method: 'AUTO_PAYOUT',
          status: 'APPROVED', // Auto-approved
          processedBy: adminId,
          processedAt: new Date(),
          accountName: girl.user.name,
          accountNumber: girl.user.phone, // Placeholder
        },
      });

      // Create transaction
      await tx.transaction.create({
        data: {
          userId: girl.userId,
          type: 'DEBIT',
          category: 'WITHDRAWAL',
          amount,
          coins: 0,
          description: `Auto-payout (weekly)`,
          status: 'PENDING',
          referenceId: withdrawal.id,
          referenceModel: 'Withdrawal',
        },
      });

      // Update girl last payout
      await tx.girl.update({
        where: { id: girlId },
        data: {
          lastPayoutAt: new Date(),
          lastPayoutAmount: amount,
        },
      });

      return withdrawal;
    });

    logInfo(
      `Auto-payout created for girl ${girlId}: ₹${netAmount} (fee: ₹${fee})`
    );

    return {
      success: true,
      girlId,
      amount,
      netAmount,
      fee,
      withdrawalId: result.id,
    };
  }

  /**
   * Run auto-payout for all eligible girls
   */
  static async runAutoPayout() {
    const girls = await this.getEligibleForPayout();

    const results = {
      total: girls.length,
      success: 0,
      failed: 0,
      skipped: 0,
      totalAmount: 0,
      errors: [],
    };

    for (const girl of girls) {
      try {
        const result = await this.processAutoPayout(girl.id);

        if (result.success) {
          results.success++;
          results.totalAmount += result.netAmount || 0;
        } else {
          results.skipped++;
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ girlId: girl.id, error: e.message });
        logError(`Auto-payout failed for girl ${girl.id}`, e);
      }
    }

    logInfo(
      `Auto-payout complete: ${results.success} success, ${results.skipped} skipped, ${results.failed} failed, ₹${results.totalAmount} total`
    );

    return results;
  }
}

module.exports = GirlService;