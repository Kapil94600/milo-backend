// ============================================
// Chat Socket Handlers
// ============================================

const { prisma } = require('../config/database');
const ChatService = require('../services/chat.service');
const { logInfo, logError } = require('../utils/logger');
const { SOCKET_EVENTS } = require('../common/constants');

// Track online users in a Map (userId -> Set<socketId>)
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
  const { getUserSocketId, isUserOnline } = helpers;

  // ============================================
  // JOIN CHAT ROOM
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_JOIN, async ({ chatId }) => {
    try {
      if (!chatId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'chatId is required' });
        return;
      }

      // Verify user is participant
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
      logInfo(`User ${userId} left chat ${chatId}`);
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

      // Send message via service (handles coin deduction + girl earning)
      const message = await ChatService.sendMessage(chatId, userId, {
        content,
        type: type || 'TEXT',
        mediaUrl,
        replyToId,
      });

      // Attach tempId so client can replace optimistic message
      const payload = { ...message, tempId: tempId || null };

      // Emit to everyone in chat room (including sender)
      io.to(`chat:${chatId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, payload);

      // Also send to participants' personal rooms (for chat list updates)
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
  // TYPING START
  // ============================================
  socket.on(SOCKET_EVENTS.TYPING_START, ({ chatId }) => {
    if (!chatId) return;
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_START, {
      chatId,
      userId,
      name: user.name,
    });
  });

  // ============================================
  // TYPING STOP
  // ============================================
  socket.on(SOCKET_EVENTS.TYPING_STOP, ({ chatId }) => {
    if (!chatId) return;
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
      chatId,
      userId,
    });
  });

  // ============================================
  // MESSAGE SEEN / CHAT OPENED
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_OPENED, async ({ chatId }) => {
    try {
      if (!chatId) return;

      const result = await ChatService.markAsRead(chatId, userId);

      // Notify other participants
      socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.MESSAGE_SEEN, {
        chatId,
        userId,
        count: result.count,
      });
    } catch (error) {
      logError('Chat opened error', error);
    }
  });

  // ============================================
  // MESSAGE DELIVERED
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
      });
    } catch (error) {
      logError('Message delivered error', error);
    }
  });
};

module.exports = { registerChatHandlers, setConnectedUsers };