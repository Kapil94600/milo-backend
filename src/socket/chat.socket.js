// ============================================
// Chat Socket Handlers — Bond (Complete)
// ============================================

const { prisma } = require('../config/database');
const ChatService = require('../services/chat.service');
const NotificationService = require('../services/notification.service');
const { logInfo, logError } = require('../utils/logger');
const { SOCKET_EVENTS } = require('../common/constants');

let connectedUsers = null;

const setConnectedUsers = (map) => {
  connectedUsers = map;
};

// ============================================
// Register Chat Handlers
// ============================================
const registerChatHandlers = (io, socket, helpers = {}) => {
  const userId = socket.data.userId;
  const user = socket.data.user;
  const { getUserSocketId } = helpers;

  // ============================================
  // JOIN CHAT ROOM
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_JOIN, async ({ chatId }) => {
    try {
      if (!chatId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'chatId is required' });
        return;
      }

      await ChatService.getChatById(chatId, userId);

      socket.join(`chat:${chatId}`);
      socket.emit(SOCKET_EVENTS.CHAT_JOINED, { chatId });
      logInfo(`User ${userId} joined chat ${chatId}`);
    } catch (error) {
      logError('Chat join error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================
  // LEAVE CHAT ROOM
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_LEAVE, ({ chatId }) => {
    if (chatId) {
      socket.leave(`chat:${chatId}`);
      socket.emit(SOCKET_EVENTS.CHAT_LEFT, { chatId });
    }
  });

  // ============================================
  // SEND MESSAGE
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (data) => {
    try {
      const { chatId, content, type, mediaUrl, replyToId, tempId } = data || {};

      if (!chatId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'chatId is required' });
        return;
      }

      const message = await ChatService.sendMessage(chatId, userId, {
        content,
        type: type || 'TEXT',
        mediaUrl,
        replyToId,
      });

      const payload = { ...message, tempId: tempId || null };

      // Emit to chat room
      io.to(`chat:${chatId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, payload);

      // Also emit to participants personal rooms
      const chat = await ChatService.getChatById(chatId, userId);
      chat.participants.forEach((p) => {
        if (p.userId !== userId) {
          io.to(`user:${p.userId}`).emit(SOCKET_EVENTS.CHAT_NEW_MESSAGE, {
            chatId,
            message: payload,
          });
        }
      });

      logInfo(`Message sent in chat ${chatId} by ${userId}`);
    } catch (error) {
      logError('Message send error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================
  // ⭐ TYPING
  // ============================================
  socket.on(SOCKET_EVENTS.TYPING_START, ({ chatId }) => {
    if (!chatId) return;
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_START, {
      chatId,
      userId,
      name: user.name,
    });
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, ({ chatId }) => {
    if (!chatId) return;
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
      chatId,
      userId,
    });
  });

  // ============================================
  // ⭐ CHAT OPENED (Mark as read)
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_OPENED, async ({ chatId }) => {
    try {
      if (!chatId) return;

      const result = await ChatService.markAsRead(chatId, userId);

      // Notify participants that messages were seen
      const chat = await ChatService.getChatById(chatId, userId);
      chat.participants.forEach((p) => {
        if (p.userId !== userId) {
          io.to(`user:${p.userId}`).emit(SOCKET_EVENTS.MESSAGE_SEEN, {
            chatId,
            seenBy: userId,
            seenAt: new Date(),
            count: result.count,
          });
        }
      });
    } catch (error) {
      logError('Chat opened error', error);
    }
  });

  // ============================================
  // ⭐ MESSAGE DELIVERED
  // ============================================
  socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, async ({ messageId, chatId }) => {
    try {
      if (!messageId || !chatId) return;

      await prisma.message.update({
        where: { id: messageId },
        data: {
          isDelivered: true,
          deliveredAt: new Date(),
        },
      });

      socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.MESSAGE_DELIVERED, {
        messageId,
        chatId,
        deliveredAt: new Date(),
      });
    } catch (error) {
      logError('Message delivered error', error);
    }
  });

  // ============================================
  // ⭐ MESSAGE READ (single message read)
  // ============================================
  socket.on('message:read', async ({ messageId, chatId }) => {
    try {
      if (!messageId || !chatId) return;

      await prisma.message.update({
        where: { id: messageId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      socket.to(`chat:${chatId}`).emit('message:read', {
        messageId,
        chatId,
        readBy: userId,
        readAt: new Date(),
      });
    } catch (error) {
      logError('Message read error', error);
    }
  });

  // ============================================
  // ⭐ REACTION ADDED (live)
  // ============================================
  socket.on('message:react', async ({ messageId, chatId, reaction }) => {
    try {
      if (!messageId || !chatId || !reaction) return;

      const result = await ChatService.addReaction(messageId, userId, reaction);

      io.to(`chat:${chatId}`).emit('message:reaction', {
        messageId,
        chatId,
        userId,
        userName: user.name,
        reaction,
        action: 'added',
      });
    } catch (error) {
      logError('Reaction error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('message:unreact', async ({ messageId, chatId }) => {
    try {
      if (!messageId || !chatId) return;

      await ChatService.removeReaction(messageId, userId);

      io.to(`chat:${chatId}`).emit('message:reaction', {
        messageId,
        chatId,
        userId,
        action: 'removed',
      });
    } catch (error) {
      logError('Unreact error', error);
    }
  });

  // ============================================
  // ⭐ CHAT:USER-SEEN (typing indicator for read)
  // ============================================
  socket.on('chat:user-seen', async ({ chatId }) => {
    try {
      if (!chatId) return;

      io.to(`chat:${chatId}`).emit('chat:user-seen', {
        chatId,
        userId,
        userName: user.name,
        seenAt: new Date(),
      });
    } catch (error) {
      logError('User seen error', error);
    }
  });

  // ============================================
  // ⭐ GIFT ANIMATION TRIGGER (NEW)
  // ============================================
  socket.on('gift:send', async ({ giftId, receiverId, chatId, message }) => {
    try {
      if (!giftId || !receiverId) return;

      // Emit animation to chat room
      if (chatId) {
        io.to(`chat:${chatId}`).emit('gift:animation', {
          giftId,
          senderId: userId,
          senderName: user.name,
          receiverId,
          chatId,
          message: message || null,
          timestamp: new Date(),
        });
      }

      // Emit to receiver personal room
      io.to(`user:${receiverId}`).emit('gift:animation', {
        giftId,
        senderId: userId,
        senderName: user.name,
        receiverId,
        message: message || null,
        timestamp: new Date(),
      });

      logInfo(`Gift animation triggered: ${giftId} from ${userId} to ${receiverId}`);
    } catch (error) {
      logError('Gift animation error', error);
    }
  });
};

module.exports = { registerChatHandlers, setConnectedUsers };