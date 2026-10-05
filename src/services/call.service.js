// ============================================
// Call Service — Voice/Video with Girl Rates + Min Coins Gate
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');
const { CallType, CallStatus, PaymentStatus } = require('../common/enums');

// Default rates (fallback if girl not set)
const DEFAULT_VOICE_RATE = 10;   // coins per minute
const DEFAULT_VIDEO_RATE = 20;   // coins per minute

// Platform commission percent
const DEFAULT_PLATFORM_COMMISSION = 50;
const DEFAULT_MIN_COINS_FOR_VIDEO = 50;

// ⭐ Lazy-load socket IO (avoid circular dep)
const getIO = () => {
  try {
    return require('../socket').getIO();
  } catch (e) {
    return null;
  }
};

class CallService {
  // ============================================
  // HELPER: Get call rates (global defaults)
  // ============================================
  static async getCallRates() {
    try {
      const [voiceSetting, videoSetting, commissionSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'COIN_VOICE_COST_PER_MINUTE' } }),
        prisma.setting.findUnique({ where: { key: 'COIN_VIDEO_COST_PER_MINUTE' } }),
        prisma.setting.findUnique({ where: { key: 'CALL_PLATFORM_COMMISSION' } }),
      ]);

      return {
        VOICE: Number(voiceSetting?.value) || DEFAULT_VOICE_RATE,
        VIDEO: Number(videoSetting?.value) || DEFAULT_VIDEO_RATE,
        platformCommission:
          Number(commissionSetting?.value) || DEFAULT_PLATFORM_COMMISSION,
      };
    } catch {
      return {
        VOICE: DEFAULT_VOICE_RATE,
        VIDEO: DEFAULT_VIDEO_RATE,
        platformCommission: DEFAULT_PLATFORM_COMMISSION,
      };
    }
  }

  // ============================================
  // ⭐ HELPER: Get girl-specific rates
  // ============================================
  static async getGirlRates(receiverId) {
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, role: true },
    });

    if (!receiver || receiver.role !== 'GIRL') {
      const defaults = await this.getCallRates();
      return {
        voiceRate: defaults.VOICE,
        videoRate: defaults.VIDEO,
        isGirlRate: false,
      };
    }

    const girl = await prisma.girl.findUnique({
      where: { userId: receiverId },
      select: {
        hourlyRate: true,
        videoCallRate: true,
        rateApproved: true,
      },
    });

    if (!girl) {
      const defaults = await this.getCallRates();
      return {
        voiceRate: defaults.VOICE,
        videoRate: defaults.VIDEO,
        isGirlRate: false,
      };
    }

    const voiceRatePerMin = Math.max(1, Math.ceil((girl.hourlyRate || 100) / 60));
    const videoRatePerMin = Math.max(2, Math.ceil((girl.videoCallRate || 200) / 60));

    return {
      voiceRate: voiceRatePerMin,
      videoRate: videoRatePerMin,
      isGirlRate: true,
      girlHourlyRate: girl.hourlyRate,
      girlVideoRate: girl.videoCallRate,
    };
  }

  // ============================================
  // Get Min Coins for Video
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
  // Check Video Eligibility
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
  // ⭐ Initiate Call (REST — socket emit added)
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
          { OR: [{ isPermanent: true }, { expiresAt: { gt: new Date() } }] },
        ],
      },
    });
    if (blocked) throw AppError.forbidden('Cannot call this user');

    // Check existing active call
    const activeCall = await prisma.call.findFirst({
      where: {
        OR: [
          { callerId, status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] } },
          { receiverId: callerId, status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] } },
          { callerId: receiverId, status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] } },
          { receiverId, status: { in: [CallStatus.INITIATED, CallStatus.CONNECTED] } },
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
        if (!girl.acceptCalls) throw AppError.badRequest('Girl is not accepting calls');
      }
    }

    // Get rates
    const rates = await this.getGirlRates(receiverId);
    const coinRate = type === CallType.VOICE ? rates.voiceRate : rates.videoRate;

    // VIDEO CALL GATE
    if (type === CallType.VIDEO) {
      const eligibility = await this.checkVideoEligibility(callerId);
      if (!eligibility.eligible) {
        throw AppError.badRequest(
          `Video calls require at least ${eligibility.requiredCoins} coins. ` +
            `You have ${eligibility.currentCoins}. Please recharge.`
        );
      }
    }

    // Check caller wallet
    const wallet = await WalletService.getWallet(callerId);
    if (wallet.coins < coinRate) {
      throw AppError.badRequest(
        `Insufficient coins. Need at least ${coinRate} coins to start ${type.toLowerCase()} call.`
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
          select: {
            id: true,
            name: true,
            profileImage: true,
            phone: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            phone: true,
          },
        },
      },
    });

    // ⭐⭐⭐ SOCKET EMIT — Notify receiver in real-time ⭐⭐⭐
    const io = getIO();
    if (io) {
      try {
        // Find receiver's socket
        const { getUserSocketId } = require('../socket');
        const receiverSocketId = getUserSocketId(receiverId);

        if (receiverSocketId) {
          const incomingEvent =
            type === CallType.VIDEO
              ? 'call:video:incoming'
              : 'call:voice:incoming';

          io.to(receiverSocketId).emit(incomingEvent, {
            callId: call.id,
            callerId,
            callerName: caller.name,
            callerImage: caller.profileImage,
            type,
            quality,
            coinRate: call.coinRate,
          });

          // Also emit to personal room for multi-device
          io.to(`user:${receiverId}`).emit(incomingEvent, {
            callId: call.id,
            callerId,
            callerName: caller.name,
            callerImage: caller.profileImage,
            type,
            quality,
            coinRate: call.coinRate,
          });

          logInfo(`📞 Call socket emitted to receiver ${receiverId} (${type})`);
        } else {
          logInfo(`📞 Receiver ${receiverId} offline — FCM only`);
        }
      } catch (e) {
        logError('Socket emit for incoming call failed', e);
      }
    }

    // FCM fallback
    (async () => {
      try {
        await NotificationService.sendCallNotification(callerId, receiverId, type);
      } catch (e) {
        logError('Call notification failed', e);
      }
    })();

    logInfo(
      `Call initiated: ${call.id} (${type}) from ${callerId} to ${receiverId} @ ${coinRate} coins/min`
    );
    return call;
  }

  // ============================================
  // Accept Call — Emit to caller
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
      include: {
        caller: { select: { id: true, name: true, profileImage: true } },
        receiver: { select: { id: true, name: true, profileImage: true } },
      },
    });

    // ⭐ Emit ACCEPTED to caller
    const io = getIO();
    if (io) {
      try {
        io.to(`user:${call.callerId}`).emit('call:accepted', {
          callId,
          receiverId,
        });
        logInfo(`📞 Call accepted emit to caller ${call.callerId}`);
      } catch (e) {
        logError('Socket emit accept failed', e);
      }
    }

    logInfo(`Call accepted: ${callId}`);
    return updated;
  }

  // ============================================
  // Reject Call — Emit to caller
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

    // ⭐ Emit REJECTED to other party
    const io = getIO();
    if (io) {
      try {
        const targetUserId = call.callerId === userId ? call.receiverId : call.callerId;
        io.to(`user:${targetUserId}`).emit('call:rejected', {
          callId,
          rejectedBy: userId,
        });
      } catch (e) {
        logError('Socket emit reject failed', e);
      }
    }

    logInfo(`Call rejected: ${callId}`);
    return updated;
  }

  // ============================================
  // Cancel Call
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

    const updated = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.CANCELLED,
        endedAt: new Date(),
        endedById: userId,
      },
    });

    // ⭐ Emit CANCELLED to receiver
    const io = getIO();
    if (io) {
      try {
        io.to(`user:${call.receiverId}`).emit('call:cancelled', {
          callId,
          callerId: userId,
        });
      } catch (e) {
        logError('Socket emit cancel failed', e);
      }
    }

    return updated;
  }

  // ============================================
  // End Call + Billing
  // ============================================
  static async endCall(callId, userId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw AppError.notFound('Call not found');

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    if (
      [CallStatus.ENDED, CallStatus.REJECTED, CallStatus.CANCELLED, CallStatus.MISSED].includes(
        call.status
      )
    ) {
      return call;
    }

    const endedAt = new Date();
    const startedAt = call.startedAt || call.createdAt;
    const durationSec = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
    const minutes = Math.max(1, Math.ceil(durationSec / 60));

    let cost = 0;
    if (call.status === CallStatus.CONNECTED && durationSec > 0) {
      cost = minutes * call.coinRate;
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const updatedCall = await tx.call.update({
          where: { id: callId },
          data: {
            status: CallStatus.ENDED,
            endedAt,
            duration: durationSec,
            cost,
            endedById: userId,
            paymentStatus: cost > 0 ? PaymentStatus.PENDING : PaymentStatus.COMPLETED,
          },
        });

        if (cost > 0 && call.status === CallStatus.CONNECTED) {
          await this.billCall(tx, call, cost, minutes, durationSec);
        }

        return updatedCall;
      });

      if (cost > 0) {
        await prisma.call.update({
          where: { id: callId },
          data: { paymentStatus: PaymentStatus.COMPLETED },
        });
        updated.paymentStatus = PaymentStatus.COMPLETED;
      }

      updated.needsReview =
        call.status === CallStatus.CONNECTED && durationSec >= 30 && cost > 0;

      // ⭐ Emit ENDED to other party
      const io = getIO();
      if (io) {
        try {
          const targetUserId =
            call.callerId === userId ? call.receiverId : call.callerId;
          io.to(`user:${targetUserId}`).emit('call:ended', {
            callId,
            endedBy: userId,
            duration: durationSec,
            cost,
          });
        } catch (e) {
          logError('Socket emit end failed', e);
        }
      }

      logInfo(`Call ended: ${callId}, duration: ${durationSec}s, cost: ${cost} coins`);
      return updated;
    } catch (error) {
      logError('Call end billing failed', error);
      const updated = await prisma.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.ENDED,
          endedAt,
          duration: durationSec,
          cost,
          endedById: userId,
          paymentStatus: PaymentStatus.FAILED,
        },
      });
      return updated;
    }
  }

  // ============================================
  // Bill Call
  // ============================================
  // ============================================
  // ⭐ Bill Call (with subscription support)
  // ============================================
  static async billCall(tx, call, cost, minutes, durationSec) {
    const { callerId, receiverId, type } = call;

    const rates = await this.getCallRates();
    const commissionPercent = rates.platformCommission;

    // ⭐ STEP 1: Try subscription
    const subResult = await this.tryUseSubscription(tx, callerId, minutes, type);

    let billableMinutes = minutes;
    let actualCost = cost;

    if (subResult.used) {
      billableMinutes = subResult.billableMinutes || 0;
      actualCost = billableMinutes * call.coinRate;

      logInfo(
        `Subscription covered ${subResult.freeMinutes} min, billing ${billableMinutes} min`
      );
    }

    // ⭐ STEP 2: If nothing to bill, skip wallet deduction
    if (actualCost <= 0) {
      logInfo('Call fully covered by subscription');
      // Still update stats
      await tx.user.update({
        where: { id: callerId },
        data: {
          totalCalls: { increment: 1 },
          ...(type === CallType.VOICE
            ? { totalVoiceMins: { increment: minutes } }
            : { totalVideoMins: { increment: minutes } }),
        },
      });

      // Credit girl (if girl receiver — based on her share)
      const receiver = await tx.user.findUnique({
        where: { id: receiverId },
        select: { id: true, role: true },
      });

      if (receiver && receiver.role === 'GIRL') {
        // Girl still gets commission from platform (or subscription fund)
        // For simplicity, skip here — could add subscription-funded payout
        await tx.girl.update({
          where: { userId: receiverId },
          data: {
            totalCalls: { increment: 1 },
            totalVoiceMins: type === CallType.VOICE ? { increment: minutes } : undefined,
            totalVideoMins: type === CallType.VIDEO ? { increment: minutes } : undefined,
          },
        });
      }

      return;
    }

    // ⭐ STEP 3: Deduct coins for billable minutes
    const callerWallet = await tx.wallet.findUnique({ where: { userId: callerId } });
    if (!callerWallet || callerWallet.coins < actualCost) {
      throw new Error('Insufficient coins');
    }

    await tx.wallet.update({
      where: { userId: callerId },
      data: {
        coins: { decrement: actualCost },
        totalSpent: { increment: actualCost },
      },
    });

    await tx.transaction.create({
      data: {
        userId: callerId,
        type: 'DEBIT',
        category: type === CallType.VOICE ? 'VOICE_CALL' : 'VIDEO_CALL',
        amount: 0,
        coins: actualCost,
        description: `${type} call (${billableMinutes} min${
          subResult.used ? `, ${subResult.freeMinutes} free` : ''
        })`,
        status: 'COMPLETED',
        balanceAfter: callerWallet.balance,
        coinsAfter: callerWallet.coins - actualCost,
        referenceId: call.id,
        referenceModel: 'Call',
      },
    });

    // ⭐ STEP 4: Credit girl (only from actual cost)
    const receiver = await tx.user.findUnique({
      where: { id: receiverId },
      select: { id: true, role: true },
    });

    if (receiver && receiver.role === 'GIRL') {
      const girlEarnings = Math.floor((actualCost * (100 - commissionPercent)) / 100);

      if (girlEarnings > 0) {
        const receiverWallet = await tx.wallet.upsert({
          where: { userId: receiverId },
          update: {
            coins: { increment: girlEarnings },
            totalEarned: { increment: girlEarnings },
          },
          create: {
            userId: receiverId,
            coins: girlEarnings,
            totalEarned: girlEarnings,
          },
        });

        await tx.transaction.create({
          data: {
            userId: receiverId,
            type: 'CREDIT',
            category: 'CALL_EARNING',
            amount: 0,
            coins: girlEarnings,
            description: `${type} call earnings (${minutes} min)`,
            status: 'COMPLETED',
            balanceAfter: receiverWallet.balance,
            coinsAfter: receiverWallet.coins,
            referenceId: call.id,
            referenceModel: 'Call',
          },
        });

        await tx.girl.update({
          where: { userId: receiverId },
          data: {
            totalCalls: { increment: 1 },
            totalVoiceMins: type === CallType.VOICE ? { increment: minutes } : undefined,
            totalVideoMins: type === CallType.VIDEO ? { increment: minutes } : undefined,
            totalCoinsEarned: { increment: girlEarnings },
            earningsTotal: { increment: girlEarnings },
            earningsToday: { increment: girlEarnings },
            earningsThisWeek: { increment: girlEarnings },
            earningsThisMonth: { increment: girlEarnings },
          },
        });

        logInfo(`Girl ${receiverId} earned ${girlEarnings} coins`);
      }
    }

    // Update caller stats
    await tx.user.update({
      where: { id: callerId },
      data: {
        totalCalls: { increment: 1 },
        totalSpent: { increment: actualCost },
        ...(type === CallType.VOICE
          ? { totalVoiceMins: { increment: minutes } }
          : { totalVideoMins: { increment: minutes } }),
      },
    });

    if (!receiver || receiver.role !== 'GIRL') {
      await tx.user.update({
        where: { id: receiverId },
        data: { totalCalls: { increment: 1 } },
      });
    }
  }
  //  ============================================
  // Get Call History
  // ============================================
  static async getCallHistory(userId, { page = 1, limit = 20, type, status } = {}) {
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
        c.status === CallStatus.ENDED && c.duration >= 30 && c.callerId === userId,
    }));

    return {
      data: enriched,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // Get Call By ID
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
  // Get Active Call
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
  // Get Missed Calls
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
  // Get Call Stats
  // ============================================
  static async getCallStats(userId) {
    const [total, missed, totalDuration, totalCost, byType] = await Promise.all([
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
  // Mark as Missed
  // ============================================
  static async markAsMissed(callId) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) return null;

    if (call.status === CallStatus.INITIATED) {
      const updated = await prisma.call.update({
        where: { id: callId },
        data: { status: CallStatus.MISSED, endedAt: new Date() },
      });

      // ⭐ Emit missed to both
      const io = getIO();
      if (io) {
        try {
          io.to(`user:${call.callerId}`).emit('call:missed', { callId });
          io.to(`user:${call.receiverId}`).emit('call:missed', { callId });
        } catch (e) {}
      }

      logInfo(`Call marked as missed: ${callId}`);
      return updated;
    }

    return call;
  }

  // ============================================
  // Save Recording
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
  // ADMIN — Update Global Call Rates
  // ============================================
  static async updateCallRates({ voiceRate, videoRate, minCoinsForVideo, platformCommission }) {
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
            description: 'Default voice call cost per minute',
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
            description: 'Default video call cost per minute',
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

    if (platformCommission !== undefined) {
      if (platformCommission < 0 || platformCommission > 100) {
        throw AppError.badRequest('Platform commission must be 0-100');
      }
      updates.push(
        prisma.setting.upsert({
          where: { key: 'CALL_PLATFORM_COMMISSION' },
          update: { value: platformCommission },
          create: {
            key: 'CALL_PLATFORM_COMMISSION',
            value: platformCommission,
            type: 'NUMBER',
            category: 'CALLS',
            description: 'Platform commission % from call earnings',
          },
        })
      );
    }

    await Promise.all(updates);
    return this.getCallRates();
  }

  // ============================================
  // ADMIN — Get All Calls
  // ============================================
  static async getAllCalls({ page = 1, limit = 20, type, status, userId } = {}) {
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
          caller: { select: { id: true, name: true, phone: true, profileImage: true } },
          receiver: { select: { id: true, name: true, phone: true, profileImage: true } },
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
    // ============================================
  // ⭐ HELPER: Try subscription for call (voice/video)
  // ============================================
  static async tryUseSubscription(tx, userId, minutes, callType) {
    const sub = await tx.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!sub) return { used: false, reason: 'no_subscription' };

    const usage = sub.usage || {
      messagesUsed: 0,
      voiceMinutesUsed: 0,
      videoMinutesUsed: 0,
      coinsUsed: 0,
    };

    const plan = await tx.subscriptionPlan.findUnique({
      where: { id: sub.planId },
    });
    if (!plan) return { used: false, reason: 'no_plan' };

    const isVoice = callType === 'VOICE';

    const freeMinutes = isVoice
      ? plan.freeVoiceMinutes || 0
      : plan.freeVideoMinutes || 0;

    const usedKey = isVoice ? 'voiceMinutesUsed' : 'videoMinutesUsed';
    const used = usage[usedKey] || 0;

    // Unlimited (negative = unlimited)
    const unlimited = freeMinutes === -1;

    if (unlimited || used < freeMinutes) {
      // Remaining free minutes
      const remaining = unlimited ? minutes : freeMinutes - used;
      const freeToUse = Math.min(minutes, remaining);
      const billableMinutes = minutes - freeToUse;

      const newUsage = {
        ...usage,
        [usedKey]: used + freeToUse,
      };

      await tx.subscription.update({
        where: { id: sub.id },
        data: { usage: newUsage },
      });

      return {
        used: true,
        freeMinutes: freeToUse,
        billableMinutes,
        planName: plan.name,
      };
    }

    return {
      used: false,
      reason: 'limit_reached',
      billableMinutes: minutes,
    };
  }
}

module.exports = CallService;