// ============================================
// Call Service — Voice/Video Calls + Billing + Min Coins Gate + Notifications
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const GirlService = require('./girl.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');
const { CallType, CallStatus, PaymentStatus } = require('../common/enums');

// Default rates (overridable by settings)
const DEFAULT_RATES = {
  VOICE: 10,
  VIDEO: 20,
};

const GIRL_EARNING_PERCENT = 50;
const DEFAULT_MIN_COINS_FOR_VIDEO = 50;

class CallService {
  // ============================================
  // 1. GET CALL RATES
  // ============================================
  static async getCallRates() {
    try {
      const voiceSetting = await prisma.setting.findUnique({
        where: { key: 'COIN_VOICE_COST_PER_MINUTE' },
      });
      const videoSetting = await prisma.setting.findUnique({
        where: { key: 'COIN_VIDEO_COST_PER_MINUTE' },
      });

      return {
        VOICE: Number(voiceSetting?.value) || DEFAULT_RATES.VOICE,
        VIDEO: Number(videoSetting?.value) || DEFAULT_RATES.VIDEO,
      };
    } catch {
      return DEFAULT_RATES;
    }
  }

  // ============================================
  // 2. GET MIN COINS FOR VIDEO
  // ============================================
  static async getMinCoinsForVideo() {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'CALL_MIN_COINS_FOR_VIDEO' },
      });
      return Number(setting?.value) || DEFAULT_MIN_COINS_FOR_VIDEO;
    } catch {
      return DEFAULT_MIN_COINS_FOR_VIDEO;
    }
  }

  // ============================================
  // 3. CHECK VIDEO ELIGIBILITY
  // ============================================
  static async checkVideoEligibility(userId) {
    const minCoins = await this.getMinCoinsForVideo();
    const wallet = await WalletService.getWallet(userId);

    const eligible = wallet.coins >= minCoins;

    return {
      eligible,
      requiredCoins: minCoins,
      currentCoins: wallet.coins,
      reason: eligible
        ? 'Video call unlocked'
        : `You need at least ${minCoins} coins to enable video calls. Current: ${wallet.coins}`,
    };
  }

  // ============================================
  // 4. INITIATE CALL
  // ============================================
  static async initiateCall(
    callerId,
    receiverId,
    type = CallType.VOICE,
    quality = 'MEDIUM'
  ) {
    if (callerId === receiverId) {
      throw AppError.badRequest('Cannot call yourself');
    }

    if (![CallType.VOICE, CallType.VIDEO].includes(type)) {
      throw AppError.badRequest('Invalid call type');
    }

    const [caller, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: callerId } }),
      prisma.user.findUnique({ where: { id: receiverId } }),
    ]);

    if (!caller || !receiver) throw AppError.notFound('User not found');
    if (!caller.isActive || !receiver.isActive) {
      throw AppError.badRequest('User is not active');
    }

    // Check block
    const blocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { userId: callerId, blockedId: receiverId },
          { userId: receiverId, blockedId: callerId },
        ],
        deletedAt: null,
        AND: [
          {
            OR: [{ isPermanent: true }, { expiresAt: { gt: new Date() } }],
          },
        ],
      },
    });
    if (blocked) throw AppError.forbidden('Cannot call this user');

    // Check existing active call
    const activeCall = await prisma.call.findFirst({
      where: {
        OR: [
          {
            callerId,
            status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] },
          },
          {
            callerId: receiverId,
            status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] },
          },
          {
            receiverId: callerId,
            status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] },
          },
          {
            receiverId,
            status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] },
          },
        ],
        deletedAt: null,
      },
    });
    if (activeCall) throw AppError.conflict('User is already in a call');

    // Check receiver's availability (if girl)
    if (receiver.role === 'GIRL') {
      const girl = await prisma.girl.findUnique({
        where: { userId: receiverId },
      });
      if (girl) {
        if (!girl.isOnline) throw AppError.badRequest('Girl is offline');
        if (!girl.isAvailable) throw AppError.badRequest('Girl is busy');
        if (!girl.acceptCalls)
          throw AppError.badRequest('Girl is not accepting calls');
      }
    }

    // VIDEO CALL GATE
    if (type === CallType.VIDEO) {
      const eligibility = await this.checkVideoEligibility(callerId);

      if (!eligibility.eligible) {
        throw AppError.badRequest(
          `Video calls require at least ${eligibility.requiredCoins} coins. ` +
            `You have ${eligibility.currentCoins}. Please recharge your wallet.`
        );
      }
    }

    // Check caller's wallet
    const rates = await this.getCallRates();
    const coinRate = rates[type];

    const wallet = await WalletService.getWallet(callerId);
    if (wallet.coins < coinRate) {
      throw AppError.badRequest(
        `Insufficient coins. You need at least ${coinRate} coins to start a ${type.toLowerCase()} call.`
      );
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        callerId,
        receiverId,
        type,
        status: CallStatus.INITIATED,
        coinRate,
        quality,
        startedAt: new Date(),
      },
      include: {
        caller: {
          select: { id: true, name: true, profileImage: true },
        },
        receiver: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    // Send call notification to receiver (async)
    (async () => {
      try {
        await NotificationService.sendCallNotification(
          callerId,
          receiverId,
          type
        );
      } catch (e) {
        logError('Call notification failed', e);
      }
    })();

    logInfo(
      `Call initiated: ${call.id} (${type}) from ${callerId} to ${receiverId}`
    );
    return call;
  }

  // ============================================
  // 5. ACCEPT CALL
  // ============================================
  static async acceptCall(callId, receiverId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw AppError.notFound('Call not found');

    if (call.receiverId !== receiverId) {
      throw AppError.forbidden('Not authorized to accept this call');
    }

    if (call.status !== CallStatus.INITIATED) {
      throw AppError.badRequest('Call is not in valid state');
    }

    // Re-check caller's wallet
    const wallet = await WalletService.getWallet(call.callerId);
    if (wallet.coins < call.coinRate) {
      throw AppError.badRequest('Caller has insufficient coins');
    }

    const updated = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.CONNECTED,
        startedAt: new Date(),
      },
    });

    logInfo(`Call accepted: ${callId}`);
    return updated;
  }

  // ============================================
  // 6. REJECT CALL
  // ============================================
  static async rejectCall(callId, userId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw AppError.notFound('Call not found');

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    const updated = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.REJECTED,
        endedAt: new Date(),
        endedById: userId,
      },
    });

    logInfo(`Call rejected: ${callId}`);
    return updated;
  }

  // ============================================
  // 7. CANCEL CALL
  // ============================================
  static async cancelCall(callId, userId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw AppError.notFound('Call not found');

    if (call.callerId !== userId) {
      throw AppError.forbidden('Only caller can cancel');
    }

    if (call.status !== CallStatus.INITIATED) {
      throw AppError.badRequest('Call already handled');
    }

    return prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.CANCELLED,
        endedAt: new Date(),
        endedById: userId,
      },
    });
  }

  // ============================================
  // 8. END CALL + BILLING
  // ============================================
  static async endCall(callId, userId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw AppError.notFound('Call not found');

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    if (
      [
        CallStatus.ENDED,
        CallStatus.REJECTED,
        CallStatus.CANCELLED,
        CallStatus.MISSED,
      ].includes(call.status)
    ) {
      return call;
    }

    const endedAt = new Date();
    const startedAt = call.startedAt || call.createdAt;
    const durationSec = Math.max(
      0,
      Math.floor((endedAt - startedAt) / 1000)
    );
    const minutes = Math.ceil(durationSec / 60);

    let cost = 0;
    if (call.status === CallStatus.CONNECTED && durationSec > 0) {
      cost = Math.max(1, minutes) * call.coinRate;
    }

    const updated = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ENDED,
        endedAt,
        duration: durationSec,
        cost,
        endedById: userId,
        paymentStatus:
          cost > 0 ? PaymentStatus.PENDING : PaymentStatus.COMPLETED,
      },
    });

    if (cost > 0 && call.status === CallStatus.CONNECTED) {
      try {
        await this.billCall(call, cost, minutes, durationSec);
        await prisma.call.update({
          where: { id: callId },
          data: { paymentStatus: PaymentStatus.COMPLETED },
        });
        updated.paymentStatus = PaymentStatus.COMPLETED;
      } catch (error) {
        logError('Call billing failed', error);
        await prisma.call.update({
          where: { id: callId },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
        updated.paymentStatus = PaymentStatus.FAILED;
      }
    }

    updated.needsReview =
      call.status === CallStatus.CONNECTED &&
      durationSec >= 30 &&
      cost > 0;

    logInfo(`Call ended: ${callId}, duration: ${durationSec}s, cost: ${cost}`);
    return updated;
  }

  // ============================================
  // 9. BILL CALL
  // ============================================
  static async billCall(call, cost, minutes, durationSec) {
    const { callerId, receiverId, type } = call;

    await WalletService.deductCoins(
      callerId,
      cost,
      type === CallType.VOICE ? 'VOICE_CALL' : 'VIDEO_CALL',
      `${type} call (${minutes} min)`,
      { referenceId: call.id, referenceModel: 'Call' }
    );

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (receiver && receiver.role === 'GIRL') {
      const girlEarnings = Math.floor((cost * GIRL_EARNING_PERCENT) / 100);

      if (girlEarnings > 0) {
        await WalletService.addCoins(
          receiverId,
          girlEarnings,
          'CALL_EARNING',
          `${type} call earnings (${minutes} min)`,
          { referenceId: call.id, referenceModel: 'Call' }
        );

        await GirlService.updateEarnings(receiverId, girlEarnings);
      }

      await GirlService.updateStats(receiverId, {
        totalCalls: 1,
        totalVoiceMinutes: type === CallType.VOICE ? minutes : 0,
        totalVideoMinutes: type === CallType.VIDEO ? minutes : 0,
      });
    }

    const updateData = {
      totalCalls: { increment: 1 },
      totalSpent: { increment: cost },
    };

    if (type === CallType.VOICE) {
      updateData.totalVoiceMins = { increment: minutes };
    } else {
      updateData.totalVideoMins = { increment: minutes };
    }

    await prisma.user.update({
      where: { id: callerId },
      data: updateData,
    });

    await prisma.user.update({
      where: { id: receiverId },
      data: { totalCalls: { increment: 1 } },
    });

    logInfo(
      `Call billed: ${cost} coins (girl earned: ${Math.floor(
        (cost * GIRL_EARNING_PERCENT) / 100
      )})`
    );
  }

  // ============================================
  // 10. GET CALL HISTORY
  // ============================================
  static async getCallHistory(
    userId,
    { page = 1, limit = 20, type, status } = {}
  ) {
    const where = {
      OR: [{ callerId: userId }, { receiverId: userId }],
      deletedAt: null,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: {
          caller: { select: { id: true, name: true, profileImage: true } },
          receiver: { select: { id: true, name: true, profileImage: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.call.count({ where }),
    ]);

    const enriched = calls.map((c) => ({
      ...c,
      isOutgoing: c.callerId === userId,
      canReview:
        c.status === CallStatus.ENDED &&
        c.duration >= 30 &&
        c.callerId === userId,
    }));

    return {
      data: enriched,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 11. GET CALL BY ID
  // ============================================
  static async getCallById(callId, userId) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: { select: { id: true, name: true, profileImage: true } },
        receiver: { select: { id: true, name: true, profileImage: true } },
      },
    });

    if (!call) throw AppError.notFound('Call not found');

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    return call;
  }

  // ============================================
  // 12. GET ACTIVE CALL
  // ============================================
  static async getActiveCall(userId) {
    return prisma.call.findFirst({
      where: {
        OR: [{ callerId: userId }, { receiverId: userId }],
        status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] },
        deletedAt: null,
      },
      include: {
        caller: { select: { id: true, name: true, profileImage: true } },
        receiver: { select: { id: true, name: true, profileImage: true } },
      },
    });
  }

  // ============================================
  // 13. GET MISSED CALLS
  // ============================================
  static async getMissedCalls(userId) {
    return prisma.call.findMany({
      where: {
        receiverId: userId,
        status: CallStatus.MISSED,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        caller: { select: { id: true, name: true, profileImage: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================
  // 14. GET CALL STATS
  // ============================================
  static async getCallStats(userId) {
    const [total, missed, totalDuration, totalCost, byType] =
      await Promise.all([
        prisma.call.count({
          where: {
            OR: [{ callerId: userId }, { receiverId: userId }],
            status: CallStatus.ENDED,
          },
        }),
        prisma.call.count({
          where: { receiverId: userId, status: CallStatus.MISSED },
        }),
        prisma.call.aggregate({
          where: {
            OR: [{ callerId: userId }, { receiverId: userId }],
            status: CallStatus.ENDED,
          },
          _sum: { duration: true },
        }),
        prisma.call.aggregate({
          where: {
            callerId: userId,
            status: CallStatus.ENDED,
            paymentStatus: PaymentStatus.COMPLETED,
          },
          _sum: { cost: true },
        }),
        prisma.call.groupBy({
          by: ['type'],
          where: {
            OR: [{ callerId: userId }, { receiverId: userId }],
            status: CallStatus.ENDED,
          },
          _count: { _all: true },
          _sum: { duration: true },
        }),
      ]);

    return {
      totalCalls: total,
      missedCalls: missed,
      totalDuration: totalDuration._sum.duration || 0,
      totalCost: totalCost._sum.cost || 0,
      byType,
    };
  }

  // ============================================
  // 15. MARK AS MISSED
  // ============================================
  static async markAsMissed(callId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) return null;

    if (call.status === CallStatus.INITIATED) {
      const updated = await prisma.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.MISSED,
          endedAt: new Date(),
        },
      });
      logInfo(`Call marked as missed: ${callId}`);
      return updated;
    }

    return call;
  }

  // ============================================
  // 16. SAVE RECORDING
  // ============================================
  static async saveRecording(callId, userId, { url, duration, size }) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw AppError.notFound('Call not found');

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    return prisma.call.update({
      where: { id: callId },
      data: {
        recordingUrl: url,
        recordingSize: size || null,
      },
    });
  }

  // ============================================
  // 17. ADMIN: Update call rates
  // ============================================
  static async updateCallRates({ voiceRate, videoRate, minCoinsForVideo }) {
    const updates = [];

    if (voiceRate !== undefined) {
      updates.push(
        prisma.setting.upsert({
          where: { key: 'COIN_VOICE_COST_PER_MINUTE' },
          update: { value: voiceRate },
          create: {
            key: 'COIN_VOICE_COST_PER_MINUTE',
            value: voiceRate,
            type: 'NUMBER',
            category: 'COINS',
            description: 'Voice call cost per minute',
          },
        })
      );
    }

    if (videoRate !== undefined) {
      updates.push(
        prisma.setting.upsert({
          where: { key: 'COIN_VIDEO_COST_PER_MINUTE' },
          update: { value: videoRate },
          create: {
            key: 'COIN_VIDEO_COST_PER_MINUTE',
            value: videoRate,
            type: 'NUMBER',
            category: 'COINS',
            description: 'Video call cost per minute',
          },
        })
      );
    }

    if (minCoinsForVideo !== undefined) {
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CALL_MIN_COINS_FOR_VIDEO' },
          update: { value: minCoinsForVideo },
          create: {
            key: 'CALL_MIN_COINS_FOR_VIDEO',
            value: minCoinsForVideo,
            type: 'NUMBER',
            category: 'CALLS',
            description: 'Minimum coins to unlock video calls',
          },
        })
      );
    }

    await Promise.all(updates);
    return this.getCallRates();
  }

  // ============================================
  // 18. ADMIN: Get all calls
  // ============================================
  static async getAllCalls(
    { page = 1, limit = 20, type, status, userId } = {}
  ) {
    const where = { deletedAt: null };
    if (type) where.type = type;
    if (status) where.status = status;
    if (userId) {
      where.OR = [{ callerId: userId }, { receiverId: userId }];
    }

    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: {
          caller: { select: { id: true, name: true, phone: true } },
          receiver: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.call.count({ where }),
    ]);

    return {
      data: calls,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }
}

module.exports = CallService;