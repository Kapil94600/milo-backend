// ============================================
// Chat Service — Bond (Complete with Subscription Usage)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');
const { ChatType, MessageType } = require('../common/enums');

// ============================================
// Default costs (fallback)
// ============================================
const DEFAULT_MESSAGE_COST = 1;
const DEFAULT_MEDIA_COST = 5;
const DEFAULT_GIRL_EARNING_PERCENT = 50;

class ChatService {
  // ============================================
  // 1. HELPER: Get Global Chat Costs
  // ============================================
  static async getChatCosts() {
    try {
      const [msgSetting, mediaSetting, girlSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'CHAT_MESSAGE_COST' } }),
        prisma.setting.findUnique({ where: { key: 'CHAT_MEDIA_COST' } }),
        prisma.setting.findUnique({
          where: { key: 'CHAT_GIRL_EARNING_PERCENT' },
        }),
      ]);

      return {
        messageCost: Number(msgSetting?.value) || DEFAULT_MESSAGE_COST,
        mediaCost: Number(mediaSetting?.value) || DEFAULT_MEDIA_COST,
        girlEarningPercent:
          Number(girlSetting?.value) || DEFAULT_GIRL_EARNING_PERCENT,
      };
    } catch (e) {
      return {
        messageCost: DEFAULT_MESSAGE_COST,
        mediaCost: DEFAULT_MEDIA_COST,
        girlEarningPercent: DEFAULT_GIRL_EARNING_PERCENT,
      };
    }
  }

  // ============================================
  // 2. HELPER: Get Girl-Specific Message Rate
  // ============================================
  static async getGirlMessageRate(girlUserId) {
    const girl = await prisma.girl.findUnique({
      where: { userId: girlUserId },
      select: { chatMessageRate: true, rateApproved: true },
    });

    if (!girl || !girl.rateApproved) {
      const costs = await this.getChatCosts();
      return costs.messageCost;
    }

    return girl.chatMessageRate || DEFAULT_MESSAGE_COST;
  }

  // ============================================
  // ⭐ 3. HELPER: Get active subscription
  // ============================================
  static async getActiveSubscription(userId) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gt: new Date() },
        deletedAt: null,
      },
      include: { plan: true },
    });
  }

  // ============================================
  // ⭐ 4. HELPER: Try to use subscription (returns true if free)
  // ============================================
  static async tryUseSubscription(tx, userId, messageType, isMedia) {
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

    // Get plan limits
    const plan = await tx.subscriptionPlan.findUnique({
      where: { id: sub.planId },
    });
    if (!plan) return { used: false, reason: 'no_plan' };

    // Free messages check (-1 = unlimited)
    const freeMessagesAllowed = plan.freeMessages;
    const unlimited = freeMessagesAllowed === -1;
    const used = usage.messagesUsed || 0;

    if (unlimited || used < freeMessagesAllowed) {
      // Increment usage
      const newUsage = {
        ...usage,
        messagesUsed: used + 1,
      };

      await tx.subscription.update({
        where: { id: sub.id },
        data: { usage: newUsage },
      });

      return {
        used: true,
        subscriptionId: sub.id,
        planName: plan.name,
      };
    }

    return { used: false, reason: 'limit_reached' };
  }

  // ============================================
  // 5. CREATE / GET DIRECT CHAT
  // ============================================
  static async createDirectChat(userId, otherUserId) {
    if (userId === otherUserId) {
      throw AppError.badRequest('Cannot create chat with yourself');
    }

    const other = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other) throw AppError.notFound('User not found');

    const blocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { userId, blockedId: otherUserId },
          { userId: otherUserId, blockedId: userId },
        ],
        deletedAt: null,
      },
    });
    if (blocked) throw AppError.forbidden('Cannot chat with this user');

    const existing = await prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        isActive: true,
        deletedAt: null,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (existing && existing.participants.length === 2) {
      return existing;
    }

    return prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });
  }

  // ============================================
  // 6. CREATE GROUP CHAT
  // ============================================
  static async createGroupChat(userId, name, participantIds = []) {
    if (!name || name.trim().length < 2) {
      throw AppError.badRequest('Group name must be at least 2 characters');
    }

    const uniqueIds = [...new Set(participantIds.filter((id) => id !== userId))];

    if (uniqueIds.length < 1) {
      throw AppError.badRequest('At least 1 other participant required');
    }

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      throw AppError.badRequest('Some participants not found');
    }

    return prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name: name.trim(),
        participants: {
          create: [
            { userId, isAdmin: true },
            ...uniqueIds.map((id) => ({ userId: id })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });
  }

  // ============================================
  // 7. GET USER'S CHATS
  // ============================================
  static async getUserChats(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      deletedAt: null,
      participants: { some: { userId } },
    };

    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                  isOnline: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chat.count({ where }),
    ]);

    const chatIds = chats.map((c) => c.id);

    const [lastMessages, unreadGroups] = await Promise.all([
      prisma.message.findMany({
        where: { chatId: { in: chatIds }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        distinct: ['chatId'],
        include: {
          sender: { select: { id: true, name: true, profileImage: true } },
        },
      }),
      prisma.message.groupBy({
        by: ['chatId'],
        where: {
          chatId: { in: chatIds },
          senderId: { not: userId },
          isRead: false,
          deletedAt: null,
        },
        _count: { _all: true },
      }),
    ]);

    const lastMsgMap = {};
    lastMessages.forEach((m) => (lastMsgMap[m.chatId] = m));

    const unreadMap = {};
    unreadGroups.forEach((g) => (unreadMap[g.chatId] = g._count._all));

    const enriched = chats.map((chat) => ({
      ...chat,
      lastMessage: lastMsgMap[chat.id] || null,
      unreadCount: unreadMap[chat.id] || 0,
    }));

    return {
      data: enriched,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 8. GET CHAT BY ID
  // ============================================
  static async getChatById(chatId, userId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (!chat || chat.deletedAt) throw AppError.notFound('Chat not found');
    if (!chat.participants.some((p) => p.userId === userId)) {
      throw AppError.forbidden('Not a participant of this chat');
    }

    return chat;
  }

  // ============================================
  // ⭐ 9. SEND MESSAGE (with subscription)
  // ============================================
  static async sendMessage(
    chatId,
    senderId,
    { content, type = 'TEXT', mediaUrl = null, replyToId = null }
  ) {
    if (!content && !mediaUrl) {
      throw AppError.badRequest('Message content or media required');
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat || !chat.isActive) throw AppError.notFound('Chat not found');
    if (!chat.participants.some((p) => p.userId === senderId)) {
      throw AppError.forbidden('Not a participant of this chat');
    }

    const costs = await this.getChatCosts();
    const isMedia = ['IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'FILE'].includes(type);
    const baseCoinCost = isMedia ? costs.mediaCost : costs.messageCost;

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, role: true, name: true },
    });
    if (!sender) throw AppError.notFound('Sender not found');

    const isSenderGirl = sender.role === 'GIRL';

    let girlReceiver = null;
    if (chat.type === 'DIRECT') {
      const otherParticipant = chat.participants.find(
        (p) => p.userId !== senderId
      );
      if (otherParticipant) {
        const otherUser = await prisma.user.findUnique({
          where: { id: otherParticipant.userId },
          select: { id: true, role: true, name: true },
        });
        if (otherUser?.role === 'GIRL') {
          girlReceiver = otherUser;
        }
      }
    }

    let coinCost = baseCoinCost;
    if (!isSenderGirl && girlReceiver && !isMedia) {
      coinCost = await this.getGirlMessageRate(girlReceiver.id);
    }

    let message = null;
    let girlEarning = 0;
    let subscriptionUsed = false;

    await prisma.$transaction(async (tx) => {
      // ⭐ STEP 1: Try subscription first (for USER sending to GIRL)
      if (!isSenderGirl && coinCost > 0) {
        const subResult = await this.tryUseSubscription(
          tx,
          senderId,
          type,
          isMedia
        );

        if (subResult.used) {
          subscriptionUsed = true;
          logInfo(
            `Subscription used for message by ${senderId} (plan: ${subResult.planName})`
          );
        }
      }

      // ⭐ STEP 2: If not covered by subscription, deduct coins
      if (!isSenderGirl && coinCost > 0 && !subscriptionUsed) {
        const updated = await tx.wallet.updateMany({
          where: {
            userId: senderId,
            coins: { gte: coinCost },
          },
          data: {
            coins: { decrement: coinCost },
            totalSpent: { increment: coinCost },
          },
        });

        if (updated.count === 0) {
          throw AppError.badRequest(
            `Insufficient coins. Need ${coinCost} coins.`
          );
        }

        const wallet = await tx.wallet.findUnique({ where: { userId: senderId } });

        await tx.transaction.create({
          data: {
            userId: senderId,
            type: 'DEBIT',
            category: 'MESSAGE_COST',
            amount: 0,
            coins: coinCost,
            description: `Message sent (${type})`,
            status: 'COMPLETED',
            balanceAfter: wallet.balance,
            coinsAfter: wallet.coins,
            referenceModel: 'Chat',
            referenceId: chatId,
          },
        });
      }

      // ⭐ STEP 3: Create message
      message = await tx.message.create({
        data: {
          chatId,
          senderId,
          content: content || '',
          type: type || MessageType.TEXT,
          mediaUrl,
          replyToId,
        },
        include: {
          sender: { select: { id: true, name: true, profileImage: true } },
        },
      });

      // ⭐ STEP 4: Credit girl (if applicable)
      if (girlReceiver && !isSenderGirl && coinCost > 0 && !subscriptionUsed) {
        const girlPercent = costs.girlEarningPercent;
        girlEarning = Math.max(1, Math.floor((coinCost * girlPercent) / 100));

        const girlWallet = await tx.wallet.upsert({
          where: { userId: girlReceiver.id },
          update: {
            coins: { increment: girlEarning },
            totalEarned: { increment: girlEarning },
          },
          create: {
            userId: girlReceiver.id,
            coins: girlEarning,
            totalEarned: girlEarning,
          },
        });

        await tx.transaction.create({
          data: {
            userId: girlReceiver.id,
            type: 'CREDIT',
            category: 'CHAT_EARNING',
            amount: 0,
            coins: girlEarning,
            description: `Chat message earnings (${type})`,
            status: 'COMPLETED',
            balanceAfter: girlWallet.balance,
            coinsAfter: girlWallet.coins,
            referenceModel: 'Message',
            referenceId: message.id,
          },
        });

        await tx.girl.update({
          where: { userId: girlReceiver.id },
          data: {
            totalMessages: { increment: 1 },
            totalCoinsEarned: { increment: girlEarning },
            earningsTotal: { increment: girlEarning },
            earningsToday: { increment: girlEarning },
            earningsThisWeek: { increment: girlEarning },
            earningsThisMonth: { increment: girlEarning },
          },
        });
      }

      // ⭐ STEP 5: Update chat lastMessage
      await tx.chat.update({
        where: { id: chatId },
        data: { lastMessageAt: new Date(), lastMessageId: message.id },
      });

      // ⭐ STEP 6: Sender stats
      await tx.user.update({
        where: { id: senderId },
        data: { totalMessages: { increment: 1 } },
      });

      if (isSenderGirl) {
        await tx.girl.update({
          where: { userId: senderId },
          data: { totalMessages: { increment: 1 } },
        });
      }
    });

    // Notifications (outside tx)
    (async () => {
      try {
        for (const participant of chat.participants) {
          if (participant.userId !== senderId) {
            await NotificationService.sendChatNotification(
              senderId,
              participant.userId,
              message
            );
          }
        }
      } catch (e) {
        logError('Chat notification failed', e);
      }
    })();

    logInfo(
      `Message sent in chat ${chatId} by ${senderId} (cost: ${coinCost}, girl earning: ${girlEarning}, sub: ${subscriptionUsed})`
    );

    return { ...message, coinCost, subscriptionUsed };
  }

  // ============================================
  // 10. GET MESSAGES
  // ============================================
  static async getMessages(chatId, userId, { page = 1, limit = 50 } = {}) {
    const participant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw AppError.forbidden('Not a participant');

    const skip = (page - 1) * limit;

    const where = {
      chatId,
      deletedAt: null,
      NOT: { deletedFor: { has: userId } },
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, profileImage: true },
          },
          reactions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    messages.reverse();

    return {
      data: messages,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 11. MARK AS READ
  // ============================================
  static async markAsRead(chatId, userId) {
    const result = await prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
        NOT: { deletedFor: { has: userId } },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  // ============================================
  // 12. EDIT MESSAGE
  // ============================================
  static async editMessage(messageId, userId, newContent) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw AppError.notFound('Message not found');
    if (message.senderId !== userId) {
      throw AppError.forbidden('Only sender can edit');
    }
    if (message.isDeletedForAll) {
      throw AppError.badRequest('Cannot edit deleted message');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        isEdited: true,
        editedAt: new Date(),
      },
    });
  }

  // ============================================
  // 13. DELETE MESSAGE (for me)
  // ============================================
  static async deleteMessageForMe(messageId, userId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw AppError.notFound('Message not found');

    const deletedFor = Array.from(new Set([...message.deletedFor, userId]));

    return prisma.message.update({
      where: { id: messageId },
      data: { deletedFor },
    });
  }

  // ============================================
  // 14. DELETE MESSAGE (for everyone)
  // ============================================
  static async deleteMessageForAll(messageId, userId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw AppError.notFound('Message not found');
    if (message.senderId !== userId) {
      throw AppError.forbidden('Only sender can delete for everyone');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: {
        isDeletedForAll: true,
        content: 'This message was deleted',
        mediaUrl: null,
      },
    });
  }

  // ============================================
  // 15. ADD REACTION
  // ============================================
  static async addReaction(messageId, userId, reaction) {
    if (!reaction || reaction.length > 10) {
      throw AppError.badRequest('Invalid reaction');
    }

    return prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { reaction },
      create: { messageId, userId, reaction },
    });
  }

  // ============================================
  // 16. REMOVE REACTION
  // ============================================
  static async removeReaction(messageId, userId) {
    await prisma.messageReaction.deleteMany({
      where: { messageId, userId },
    });
    return { message: 'Reaction removed' };
  }

  // ============================================
  // 17. ADD PARTICIPANTS (group)
  // ============================================
  static async addParticipants(chatId, adminId, userIds = []) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw AppError.notFound('Chat not found');
    if (chat.type !== ChatType.GROUP) throw AppError.badRequest('Not a group chat');

    const admin = chat.participants.find((p) => p.userId === adminId);
    if (!admin || !admin.isAdmin) throw AppError.forbidden('Only admin can add');

    const existingIds = chat.participants.map((p) => p.userId);
    const newIds = userIds.filter((id) => !existingIds.includes(id));

    if (newIds.length === 0) return chat;

    await prisma.chatParticipant.createMany({
      data: newIds.map((id) => ({ chatId, userId: id })),
    });

    return this.getChatById(chatId, adminId);
  }

  // ============================================
  // 18. REMOVE PARTICIPANT
  // ============================================
  static async removeParticipant(chatId, adminId, userId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw AppError.notFound('Chat not found');
    if (chat.type !== ChatType.GROUP) throw AppError.badRequest('Not a group chat');

    const admin = chat.participants.find((p) => p.userId === adminId);
    if (!admin || !admin.isAdmin) throw AppError.forbidden('Only admin can remove');
    if (adminId === userId) throw AppError.badRequest('Admin cannot remove self');

    await prisma.chatParticipant.deleteMany({
      where: { chatId, userId },
    });

    return { message: 'Participant removed' };
  }

  // ============================================
  // 19. LEAVE GROUP
  // ============================================
  static async leaveGroup(chatId, userId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw AppError.notFound('Chat not found');
    if (chat.type !== ChatType.GROUP) throw AppError.badRequest('Not a group chat');

    await prisma.chatParticipant.deleteMany({ where: { chatId, userId } });

    const remaining = await prisma.chatParticipant.count({ where: { chatId } });
    if (remaining === 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { isActive: false, deletedAt: new Date() },
      });
    }

    return { message: 'Left group' };
  }

  // ============================================
  // 20. GET UNREAD COUNT
  // ============================================
  static async getTotalUnreadCount(userId) {
    const count = await prisma.message.count({
      where: {
        chat: {
          participants: { some: { userId } },
          isActive: true,
        },
        senderId: { not: userId },
        isRead: false,
        deletedAt: null,
        NOT: { deletedFor: { has: userId } },
      },
    });

    return count;
  }

  // ============================================
  // 21. SEARCH MESSAGES
  // ============================================
  static async searchMessages(userId, query, chatId = null) {
    if (!query || query.length < 2) {
      throw AppError.badRequest('Search query too short');
    }

    const where = {
      content: { contains: query, mode: 'insensitive' },
      deletedAt: null,
      NOT: { deletedFor: { has: userId } },
      chat: {
        participants: { some: { userId } },
        isActive: true,
      },
    };

    if (chatId) where.chatId = chatId;

    return prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, profileImage: true } },
        chat: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================
  // 22. DELETE CHAT (soft)
  // ============================================
  static async deleteChat(chatId, userId) {
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw AppError.notFound('Chat not found');

    const participant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw AppError.forbidden('Not a participant');

    await prisma.chatParticipant.delete({
      where: { chatId_userId: { chatId, userId } },
    });

    const remaining = await prisma.chatParticipant.count({ where: { chatId } });
    if (remaining === 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { isActive: false, deletedAt: new Date() },
      });
    }

    return { message: 'Chat deleted' };
  }

  // ============================================
  // 23. ADMIN — Get All Chats
  // ============================================
  static async getAllChats({
    page = 1,
    limit = 20,
    type,
    search,
    userId,
  } = {}) {
    const where = { deletedAt: null };
    if (type) where.type = type;
    if (userId) {
      where.participants = { some: { userId } };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  profileImage: true,
                  role: true,
                },
              },
            },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chat.count({ where }),
    ]);

    const enriched = chats.map((c) => ({
      ...c,
      messageCount: c._count.messages,
      _count: undefined,
    }));

    return {
      data: enriched,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 24. ADMIN — Get Messages of a Chat
  // ============================================
  static async getChatMessagesAdmin(chatId, { page = 1, limit = 50 } = {}) {
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw AppError.notFound('Chat not found');

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { chatId, deletedAt: null },
        include: {
          sender: {
            select: { id: true, name: true, profileImage: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { chatId, deletedAt: null } }),
    ]);

    messages.reverse();

    return {
      data: messages,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }
    // ============================================
  // ⭐ 25. FORWARD MESSAGE (NEW)
  // ============================================
  static async forwardMessage(messageId, userId, targetChatIds = []) {
    if (!targetChatIds || targetChatIds.length === 0) {
      throw AppError.badRequest('At least one target chat required');
    }

    // Verify original message
    const original = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { participants: true } } },
    });

    if (!original) throw AppError.notFound('Message not found');
    if (original.isDeletedForAll) {
      throw AppError.badRequest('Cannot forward deleted message');
    }

    // Verify user is participant of source chat
    if (!original.chat.participants.some((p) => p.userId === userId)) {
      throw AppError.forbidden('Not authorized');
    }

    // Verify user is participant of all target chats
    const targetChats = await prisma.chat.findMany({
      where: { id: { in: targetChatIds } },
      include: { participants: true },
    });

    for (const chat of targetChats) {
      if (!chat.participants.some((p) => p.userId === userId)) {
        throw AppError.forbidden(`Not a participant of chat ${chat.id}`);
      }
    }

    // Create forwarded messages
    const forwardedMessages = await prisma.$transaction(
      targetChats.map((chat) =>
        prisma.message.create({
          data: {
            chatId: chat.id,
            senderId: userId,
            content: original.content,
            type: original.type,
            mediaUrl: original.mediaUrl,
            data: {
              isForwarded: true,
              originalMessageId: original.id,
              originalSenderId: original.senderId,
            },
          },
          include: {
            sender: { select: { id: true, name: true, profileImage: true } },
          },
        })
      )
    );

    // Update target chats' lastMessageAt
    await prisma.chat.updateMany({
      where: { id: { in: targetChatIds } },
      data: { lastMessageAt: new Date() },
    });

    logInfo(`Message ${messageId} forwarded to ${targetChats.length} chats`);
    return { forwardedCount: forwardedMessages.length, messages: forwardedMessages };
  }

  // ============================================
  // ⭐ 26. STAR / UNSTAR MESSAGE (NEW)
  // ============================================
  static async toggleStarMessage(messageId, userId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { participants: true } } },
    });

    if (!message) throw AppError.notFound('Message not found');

    if (!message.chat.participants.some((p) => p.userId === userId)) {
      throw AppError.forbidden('Not a participant of this chat');
    }

    // Check if already starred by user (stored in data field)
    const starredBy = message.data?.starredBy || [];
    const isStarred = starredBy.includes(userId);

    const newStarredBy = isStarred
      ? starredBy.filter((id) => id !== userId)
      : [...starredBy, userId];

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        data: {
          ...(message.data || {}),
          starredBy: newStarredBy,
        },
      },
    });

    return {
      message: updated,
      isStarred: !isStarred,
    };
  }

  // ============================================
  // ⭐ 27. GET STARRED MESSAGES (NEW)
  // ============================================
  static async getStarredMessages(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    // Get all starred messages by user
    const where = {
      deletedAt: null,
      NOT: { deletedFor: { has: userId } },
      chat: {
        participants: { some: { userId } },
        isActive: true,
      },
    };

    // Fetch all messages and filter starred (since JSON field query on array is tricky in Prisma)
    const allMessages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, profileImage: true } },
        chat: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // safety cap
    });

    const starred = allMessages.filter((m) => {
      const starredBy = m.data?.starredBy || [];
      return starredBy.includes(userId);
    });

    const total = starred.length;
    const paginated = starred.slice(skip, skip + limit);

    return {
      data: paginated,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // ⭐ 28. EXPORT CHAT (NEW)
  // ============================================
  static async exportChat(chatId, userId, { format = 'json' } = {}) {
    // Verify participant
    const participant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw AppError.forbidden('Not a participant');

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    if (!chat) throw AppError.notFound('Chat not found');

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        NOT: { deletedFor: { has: userId } },
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      chat: {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdAt: chat.createdAt,
        participants: chat.participants.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          phone: p.user.phone,
        })),
      },
      totalMessages: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender.name,
        content: m.content,
        type: m.type,
        mediaUrl: m.mediaUrl,
        isEdited: m.isEdited,
        createdAt: m.createdAt,
      })),
    };

    logInfo(`Chat ${chatId} exported by ${userId} (${messages.length} messages)`);

    return exportData;
  }
}

module.exports = ChatService;