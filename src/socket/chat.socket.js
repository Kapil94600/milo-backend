// ============================================
// Chat Socket Handlers
// ============================================

const { prisma } = require('../config/database');
const ChatService = require('../services/chat.service');
const { logInfo, logError } = require('../utils/logger');
const { SOCKET_EVENTS } = require('../common/constants');

// Track online users in a Map (userId -> socketId)
// This will be passed from socket/index.js
let connectedUsers = null;

const setConnectedUsers = (map) => {
  connectedUsers = map;
};

const registerChatHandlers = (io, socket) => {
  const userId = socket.data.userId;
  const user = socket.data.user;

  // ============================================
  // JOIN CHAT ROOM
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_JOIN, async ({ chatId }) => {
    try {
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
    socket.leave(`chat:${chatId}`);
    socket.emit(SOCKET_EVENTS.CHAT_LEFT, { chatId });
    logInfo(`User ${userId} left chat ${chatId}`);
  });

  // ============================================
  // SEND MESSAGE
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (data) => {
    try {
      const { chatId, content, type, mediaUrl, replyToId, tempId } = data;

      const message = await ChatService.sendMessage(chatId, userId, {
        content,
        type,
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
    socket.to(`chat:${chatId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
      chatId,
      userId,
    });
  });

  // ============================================
  // MESSAGE SEEN
  // ============================================
  socket.on(SOCKET_EVENTS.CHAT_OPENED, async ({ chatId }) => {
    try {
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
      // Update DB
      await prisma.message.update({
        where: { id: messageId },
        data: {
          isDelivered: true,
          deliveredAt: new Date(),
        },
      });

      // Notify sender
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