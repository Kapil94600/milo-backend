// ============================================
// Chat Service — Direct & Group Chats, Messages + Coin Billing + Notifications
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const WalletService = require('./wallet.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');
const { ChatType, MessageType } = require('../common/enums');

// Default chat costs
const DEFAULT_MESSAGE_COST = 1;
const DEFAULT_MEDIA_COST = 5;
const DEFAULT_GIRL_EARNING_PERCENT = 50;

class ChatService {
  // ============================================
  // HELPER: Get chat costs from settings
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
    } catch {
      return {
        messageCost: DEFAULT_MESSAGE_COST,
        mediaCost: DEFAULT_MEDIA_COST,
        girlEarningPercent: DEFAULT_GIRL_EARNING_PERCENT,
      };
    }
  }

  // ============================================
  // 1. CREATE / GET DIRECT CHAT
  // ============================================
  static async createDirectChat(userId, otherUserId) {
    if (userId === otherUserId) {
      throw AppError.badRequest('Cannot create chat with yourself');
    }

    const other = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other) throw AppError.notFound('User not found');

    // Check block (both ways)
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

    // Check if direct chat already exists
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
  // 2. CREATE GROUP CHAT
  // ============================================
  static async createGroupChat(userId, name, participantIds = []) {
    if (!name || name.trim().length < 2) {
      throw AppError.badRequest('Group name must be at least 2 characters');
    }

    const uniqueIds = [
      ...new Set(participantIds.filter((id) => id !== userId)),
    ];

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
  // 3. GET USER'S CHATS (paginated)
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

    const enriched = await Promise.all(
      chats.map(async (chat) => {
        const [lastMessage, unreadCount] = await Promise.all([
          prisma.message.findFirst({
            where: { chatId: chat.id, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: { id: true, name: true, profileImage: true },
              },
            },
          }),
          prisma.message.count({
            where: {
              chatId: chat.id,
              senderId: { not: userId },
              isRead: false,
              deletedAt: null,
              NOT: { deletedFor: { has: userId } },
            },
          }),
        ]);

        return { ...chat, lastMessage, unreadCount };
      })
    );

    return {
      data: enriched,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. GET CHAT BY ID
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
  // 5. SEND MESSAGE (WITH COIN DEDUCTION + GIRL CREDIT)
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

    // ============================================
    // COIN DEDUCTION
    // ============================================
    const costs = await this.getChatCosts();
    const isMedia = ['IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'FILE'].includes(type);
    const coinCost = isMedia ? costs.mediaCost : costs.messageCost;

    // Check if sender is a girl — girls don't pay to send messages
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, role: true, name: true },
    });

    const isSenderGirl = sender?.role === 'GIRL';

    // Deduct coins only if sender is NOT a girl
    if (!isSenderGirl && coinCost > 0) {
      const wallet = await WalletService.getWallet(senderId);

      if (wallet.coins < coinCost) {
        throw AppError.badRequest(
          `Insufficient coins. You need at least ${coinCost} coins to send this message. ` +
            `Current: ${wallet.coins}. Please recharge.`
        );
      }

      try {
        await WalletService.deductCoins(
          senderId,
          coinCost,
          'MESSAGE_COST',
          `Message sent (${type})`,
          { referenceModel: 'Chat', referenceId: chatId }
        );
      } catch (err) {
        logError('Chat coin deduction failed', err);
        throw AppError.badRequest('Failed to deduct coins. Please try again.');
      }
    }

    // ============================================
    // FIND GIRL RECEIVER
    // ============================================
    const otherParticipants = chat.participants.filter(
      (p) => p.userId !== senderId
    );

    let girlReceiver = null;

    for (const participant of otherParticipants) {
      const otherUser = await prisma.user.findUnique({
        where: { id: participant.userId },
        select: { id: true, role: true, name: true },
      });

      if (otherUser?.role === 'GIRL') {
        girlReceiver = otherUser;
        break;
      }
    }

    // ============================================
    // CREATE MESSAGE
    // ============================================
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        content: content || '',
        type: type || MessageType.TEXT,
        mediaUrl,
        replyToId,
      },
      include: {
        sender: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    // ============================================
    // ✅ CREDIT GIRL (configurable %)
    // ============================================
    if (girlReceiver && !isSenderGirl && coinCost > 0) {
      try {
        const girlPercent = costs.girlEarningPercent;

        // ✅ Ensure minimum 1 coin if user paid at least 1 coin
        const girlEarning = Math.max(
          1,
          Math.floor((coinCost * girlPercent) / 100)
        );

        await WalletService.addCoins(
          girlReceiver.id,
          girlEarning,
          'CHAT_EARNING',
          `Chat message earnings (${type})`,
          { referenceModel: 'Message', referenceId: message.id }
        );

        // Update girl's stats
        await prisma.girl.update({
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

        logInfo(
          `Girl ${girlReceiver.id} earned ${girlEarning} coins from chat message`
        );
      } catch (err) {
        logError('Girl chat earning credit failed', err);
        // Don't throw — message already sent
      }
    }

    // ============================================
    // Update chat lastMessageAt
    // ============================================
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date(), lastMessageId: message.id },
    });

    // ============================================
    // Update sender stats
    // ============================================
    await prisma.user.update({
      where: { id: senderId },
      data: { totalMessages: { increment: 1 } },
    });

    // If girl is sender, update her stats too
    if (isSenderGirl) {
      await prisma.girl.update({
        where: { userId: senderId },
        data: { totalMessages: { increment: 1 } },
      });
    }

    // ============================================
    // Notifications
    // ============================================
    (async () => {
      try {
        for (const participant of otherParticipants) {
          await NotificationService.sendChatNotification(
            senderId,
            participant.userId,
            message
          );
        }
      } catch (e) {
        logError('Chat notification failed', e);
      }
    })();

    logInfo(
      `Message sent in chat ${chatId} by ${senderId} (cost: ${coinCost} coins)`
    );

    return { ...message, coinCost };
  }

  // ============================================
  // 6. GET MESSAGES
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
  // 7. MARK AS READ
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
  // 8. EDIT MESSAGE
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
  // 9. DELETE MESSAGE (for me)
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
  // 10. DELETE MESSAGE (for everyone)
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
  // 11. ADD REACTION
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
  // 12. REMOVE REACTION
  // ============================================
  static async removeReaction(messageId, userId) {
    await prisma.messageReaction.deleteMany({
      where: { messageId, userId },
    });
    return { message: 'Reaction removed' };
  }

  // ============================================
  // 13. ADD PARTICIPANTS (group)
  // ============================================
  static async addParticipants(chatId, adminId, userIds = []) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw AppError.notFound('Chat not found');
    if (chat.type !== ChatType.GROUP)
      throw AppError.badRequest('Not a group chat');

    const admin = chat.participants.find((p) => p.userId === adminId);
    if (!admin || !admin.isAdmin)
      throw AppError.forbidden('Only admin can add');

    const existingIds = chat.participants.map((p) => p.userId);
    const newIds = userIds.filter((id) => !existingIds.includes(id));

    if (newIds.length === 0) return chat;

    await prisma.chatParticipant.createMany({
      data: newIds.map((id) => ({ chatId, userId: id })),
    });

    return this.getChatById(chatId, adminId);
  }

  // ============================================
  // 14. REMOVE PARTICIPANT
  // ============================================
  static async removeParticipant(chatId, adminId, userId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw AppError.notFound('Chat not found');
    if (chat.type !== ChatType.GROUP)
      throw AppError.badRequest('Not a group chat');

    const admin = chat.participants.find((p) => p.userId === adminId);
    if (!admin || !admin.isAdmin)
      throw AppError.forbidden('Only admin can remove');

    if (adminId === userId)
      throw AppError.badRequest('Admin cannot remove self');

    await prisma.chatParticipant.deleteMany({
      where: { chatId, userId },
    });

    return { message: 'Participant removed' };
  }

  // ============================================
  // 15. LEAVE GROUP
  // ============================================
  static async leaveGroup(chatId, userId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw AppError.notFound('Chat not found');
    if (chat.type !== ChatType.GROUP)
      throw AppError.badRequest('Not a group chat');

    await prisma.chatParticipant.deleteMany({ where: { chatId, userId } });

    const remaining = await prisma.chatParticipant.count({
      where: { chatId },
    });
    if (remaining === 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { isActive: false, deletedAt: new Date() },
      });
    }

    return { message: 'Left group' };
  }

  // ============================================
  // 16. GET UNREAD COUNT (total)
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
  // 17. SEARCH MESSAGES
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
  // 18. DELETE CHAT (soft)
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

    const remaining = await prisma.chatParticipant.count({
      where: { chatId },
    });
    if (remaining === 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { isActive: false, deletedAt: new Date() },
      });
    }

    return { message: 'Chat deleted' };
  }
}

module.exports = ChatService;