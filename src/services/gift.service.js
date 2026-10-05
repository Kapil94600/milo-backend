// ============================================
// Gift Service — Bond (Gift % from settings)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const NotificationService = require('./notification.service');
const UploadService = require('./upload.service');
const { logInfo, logError } = require('../utils/logger');
const { GiftCategory, GiftRarity, PaymentStatus } = require('../common/enums');

// ⭐ Default (fallback)
const DEFAULT_GIFT_RECEIVER_PERCENT = 50;

class GiftService {
  // ============================================
  // ⭐ HELPER: Get gift receiver percent from settings
  // ============================================
  static async getGiftReceiverPercent() {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'COIN_GIFT_RECEIVER_PERCENT' },
      });
      return Number(setting?.value) || DEFAULT_GIFT_RECEIVER_PERCENT;
    } catch {
      return DEFAULT_GIFT_RECEIVER_PERCENT;
    }
  }

  // ============================================
  // HELPER: Resolve image
  // ============================================
  static async resolveImage(data, folder = 'gifts') {
    if (data._uploadedFile) {
      const result = await UploadService.uploadFile(data._uploadedFile, folder);
      return result.url;
    }
    if (data.image && typeof data.image === 'string') {
      return data.image.trim();
    }
    throw AppError.badRequest('Gift image is required (URL or file upload)');
  }

  // ============================================
  // 1. CREATE GIFT
  // ============================================
  static async createGift(data, adminId) {
    const imageUrl = await this.resolveImage(data, 'gifts');

    const thumbnailUrl = data.thumbnailFile
      ? (await UploadService.uploadFile(data.thumbnailFile, 'gifts')).url
      : data.thumbnail
      ? data.thumbnail.trim()
      : null;

    const animationUrl = data.animationFile
      ? (await UploadService.uploadFile(data.animationFile, 'gifts')).url
      : data.animationUrl
      ? data.animationUrl.trim()
      : null;

    const soundUrl = data.soundFile
      ? (await UploadService.uploadFile(data.soundFile, 'gifts')).url
      : data.soundUrl
      ? data.soundUrl.trim()
      : null;

    return prisma.gift.create({
      data: {
        name: data.name,
        description: data.description || null,
        image: imageUrl,
        thumbnail: thumbnailUrl,
        animationUrl,
        soundUrl,
        coins: data.coins,
        price: data.price,
        category: data.category || GiftCategory.OTHER,
        rarity: data.rarity || GiftRarity.COMMON,
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
        displayOrder: data.displayOrder || 0,
        createdBy: adminId,
      },
    });
  }

  // ============================================
  // 2. GET GIFTS
  // ============================================
  static async getGifts(
    { page = 1, limit = 20, isActive, category, rarity, isFeatured, search } = {}
  ) {
    const where = { deletedAt: null };
    if (isActive !== undefined) where.isActive = isActive;
    if (category) where.category = category;
    if (rarity) where.rarity = rarity;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [gifts, total] = await Promise.all([
      prisma.gift.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.gift.count({ where }),
    ]);

    return {
      data: gifts,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 3. GET ACTIVE GIFTS
  // ============================================
  static async getActiveGifts(category = null) {
    const where = { isActive: true, deletedAt: null };
    if (category) where.category = category;

    return prisma.gift.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
    });
  }

  // ============================================
  // 4. GET GIFT BY ID
  // ============================================
  static async getGiftById(id) {
    const gift = await prisma.gift.findUnique({ where: { id } });
    if (!gift || gift.deletedAt) throw AppError.notFound('Gift not found');
    return gift;
  }

  // ============================================
  // 5. UPDATE GIFT
  // ============================================
  static async updateGift(id, data) {
    const existing = await prisma.gift.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Gift not found');

    const allowed = [
      'name', 'description', 'coins', 'price', 'category', 'rarity',
      'isActive', 'isFeatured', 'displayOrder',
    ];
    const updates = helpers.pick(data, allowed);

    if (data._uploadedFile || data.image) {
      updates.image = await this.resolveImage(data, 'gifts');
    }

    if (data.thumbnailFile) {
      updates.thumbnail = (await UploadService.uploadFile(data.thumbnailFile, 'gifts')).url;
    } else if (data.thumbnail !== undefined) {
      updates.thumbnail = data.thumbnail ? data.thumbnail.trim() : null;
    }

    if (data.animationFile) {
      updates.animationUrl = (await UploadService.uploadFile(data.animationFile, 'gifts')).url;
    } else if (data.animationUrl !== undefined) {
      updates.animationUrl = data.animationUrl ? data.animationUrl.trim() : null;
    }

    if (data.soundFile) {
      updates.soundUrl = (await UploadService.uploadFile(data.soundFile, 'gifts')).url;
    } else if (data.soundUrl !== undefined) {
      updates.soundUrl = data.soundUrl ? data.soundUrl.trim() : null;
    }

    return prisma.gift.update({ where: { id }, data: updates });
  }

  // ============================================
  // 6. DELETE GIFT
  // ============================================
  static async deleteGift(id) {
    const existing = await prisma.gift.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Gift not found');

    return prisma.gift.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================
  // 7. TOGGLE STATUS
  // ============================================
  static async toggleGiftStatus(id, isActive) {
    const existing = await prisma.gift.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Gift not found');

    return prisma.gift.update({ where: { id }, data: { isActive } });
  }

  // ============================================
  // ⭐ 8. SEND GIFT (uses settings for receiver %)
  // ============================================
  static async sendGift(
    senderId,
    receiverId,
    giftId,
    { message = '', isAnonymous = false, chatId = null } = {}
  ) {
    if (senderId === receiverId) {
      throw AppError.badRequest('Cannot send gift to yourself');
    }

    const [sender, receiver, gift] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId } }),
      prisma.user.findUnique({ where: { id: receiverId } }),
      prisma.gift.findUnique({ where: { id: giftId } }),
    ]);

    if (!sender) throw AppError.notFound('Sender not found');
    if (!receiver) throw AppError.notFound('Receiver not found');
    if (!gift || gift.deletedAt) throw AppError.notFound('Gift not found');
    if (!gift.isActive) throw AppError.badRequest('Gift not available');

    const blocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { userId: senderId, blockedId: receiverId },
          { userId: receiverId, blockedId: senderId },
        ],
        deletedAt: null,
      },
    });
    if (blocked) throw AppError.forbidden('Cannot send gift to this user');

    const wallet = await WalletService.getWallet(senderId);
    if (wallet.coins < gift.coins) {
      throw AppError.badRequest(
        `Insufficient coins. Need ${gift.coins}, have ${wallet.coins}`
      );
    }

    // ⭐ Get receiver percent from settings
    const receiverPercent = await this.getGiftReceiverPercent();

    const result = await prisma.$transaction(async (tx) => {
      // Atomic deduct
      const updated = await tx.wallet.updateMany({
        where: { userId: senderId, coins: { gte: gift.coins } },
        data: {
          coins: { decrement: gift.coins },
          totalSpent: { increment: gift.coins },
        },
      });

      if (updated.count === 0) {
        throw AppError.badRequest('Insufficient coins');
      }

      const senderWallet = await tx.wallet.findUnique({ where: { userId: senderId } });

      await tx.transaction.create({
        data: {
          userId: senderId,
          type: 'DEBIT',
          category: 'GIFT_SENT',
          amount: 0,
          coins: gift.coins,
          description: `Sent ${gift.name}`,
          status: 'COMPLETED',
          balanceAfter: senderWallet.balance,
          coinsAfter: senderWallet.coins,
          referenceModel: 'Gift',
          referenceId: gift.id,
        },
      });

      // ⭐ Credit receiver (uses settings)
      const receiverCoins = Math.floor((gift.coins * receiverPercent) / 100);

      const receiverWallet = await tx.wallet.upsert({
        where: { userId: receiverId },
        update: {
          coins: { increment: receiverCoins },
          totalEarned: { increment: receiverCoins },
        },
        create: {
          userId: receiverId,
          coins: receiverCoins,
          totalEarned: receiverCoins,
        },
      });

      if (receiverCoins > 0) {
        await tx.transaction.create({
          data: {
            userId: receiverId,
            type: 'CREDIT',
            category: 'GIFT_RECEIVED',
            amount: 0,
            coins: receiverCoins,
            description: `Received ${gift.name}${isAnonymous ? ' (anonymous)' : ''}`,
            status: 'COMPLETED',
            balanceAfter: receiverWallet.balance,
            coinsAfter: receiverWallet.coins,
            referenceModel: 'Gift',
            referenceId: gift.id,
          },
        });
      }

      await tx.user.update({
        where: { id: receiverId },
        data: { totalCoins: { increment: receiverCoins } },
      });

      const giftTx = await tx.giftTransaction.create({
        data: {
          giftId: gift.id,
          senderId,
          receiverId,
          chatId,
          coins: gift.coins,
          price: gift.price,
          receiverCoins,
          message: message || null,
          isAnonymous,
          status: PaymentStatus.COMPLETED,
        },
        include: {
          gift: { select: { id: true, name: true, image: true, rarity: true } },
          sender: { select: { id: true, name: true, profileImage: true } },
          receiver: { select: { id: true, name: true, profileImage: true } },
        },
      });

      await tx.gift.update({
        where: { id: gift.id },
        data: { totalSent: { increment: 1 } },
      });

      return giftTx;
    });

    try {
      await NotificationService.sendGiftNotification(receiverId, senderId, gift, isAnonymous);
    } catch (e) {
      logError('Gift notification failed', e);
    }

    logInfo(
      `Gift sent: ${gift.name} from ${senderId} to ${receiverId} (receiver: ${receiverPercent}%)`
    );
    return result;
  }

  // ============================================
  // 9. GET GIFT TRANSACTIONS
  // ============================================
  static async getGiftTransactions(
    userId,
    { page = 1, limit = 20, status, type, giftId } = {}
  ) {
    const where = { OR: [{ senderId: userId }, { receiverId: userId }] };

    if (type === 'sent') {
      where.senderId = userId;
      delete where.OR;
    }
    if (type === 'received') {
      where.receiverId = userId;
      delete where.OR;
    }
    if (status) where.status = status;
    if (giftId) where.giftId = giftId;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.giftTransaction.findMany({
        where,
        include: {
          gift: {
            select: { id: true, name: true, image: true, category: true, rarity: true },
          },
          sender: { select: { id: true, name: true, profileImage: true } },
          receiver: { select: { id: true, name: true, profileImage: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.giftTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 10. GET UNREAD GIFTS
  // ============================================
  static async getUnreadGifts(userId) {
    return prisma.giftTransaction.findMany({
      where: {
        receiverId: userId,
        isRead: false,
        status: PaymentStatus.COMPLETED,
      },
      include: {
        gift: { select: { id: true, name: true, image: true, rarity: true } },
        sender: { select: { id: true, name: true, profileImage: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================
  // 11. MARK AS READ
  // ============================================
  static async markAsRead(transactionId, userId) {
    const tx = await prisma.giftTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw AppError.notFound('Gift transaction not found');
    if (tx.receiverId !== userId) throw AppError.forbidden('Not authorized');

    return prisma.giftTransaction.update({
      where: { id: transactionId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ============================================
  // 12. STATS
  // ============================================
  static async getGiftStats() {
    const [
      totalGifts,
      activeGifts,
      totalTransactions,
      coinsSpent,
      byCategory,
      byRarity,
      topGifts,
    ] = await Promise.all([
      prisma.gift.count({ where: { deletedAt: null } }),
      prisma.gift.count({ where: { isActive: true, deletedAt: null } }),
      prisma.giftTransaction.count({ where: { status: PaymentStatus.COMPLETED } }),
      prisma.giftTransaction.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { coins: true, price: true },
      }),
      prisma.gift.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.gift.groupBy({
        by: ['rarity'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.gift.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { totalSent: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalGifts,
      activeGifts,
      totalTransactions,
      totalCoinsSpent: coinsSpent._sum.coins || 0,
      totalMoneySpent: coinsSpent._sum.price || 0,
      byCategory,
      byRarity,
      topGifts,
    };
  }

  // ============================================
  // 13. GET TOP GIFTS
  // ============================================
  static async getTopGifts(limit = 10) {
    return prisma.gift.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ totalSent: 'desc' }, { price: 'asc' }],
      take: limit,
    });
  }

  // ============================================
  // 14. GET GIFTS BY CATEGORY
  // ============================================
  static async getGiftsByCategory(category) {
    return prisma.gift.findMany({
      where: { category, isActive: true, deletedAt: null },
      orderBy: { price: 'asc' },
    });
  }

  // ============================================
  // 15. GET GIFTS BY RARITY
  // ============================================
  static async getGiftsByRarity(rarity) {
    return prisma.gift.findMany({
      where: { rarity, isActive: true, deletedAt: null },
      orderBy: { price: 'asc' },
    });
  }
    // ============================================
  // ⭐ 16. GET UNREAD GIFT COUNT (NEW)
  // ============================================
  static async getUnreadGiftCount(userId) {
    const count = await prisma.giftTransaction.count({
      where: {
        receiverId: userId,
        isRead: false,
        status: 'COMPLETED',
      },
    });

    return { count };
  }
}

module.exports = GiftService;