// ============================================
// Socket.IO Setup — Complete
// ============================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../config/database');
const { getRedisPubSub } = require('../config/redis');
const { logInfo, logError } = require('../utils/logger');
const { SOCKET_EVENTS } = require('../common/constants');
const { registerChatHandlers, setConnectedUsers } = require('./chat.socket');
const { registerCallHandlers } = require('./call.socket');
const NotificationService = require('../services/notification.service');

let io = null;
const connectedUsers = new Map(); // userId -> Set<socketId>

// ============================================
// Initialize Socket.IO
// ============================================
const initSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: config.SOCKET.PATH,
    transports: ['websocket', 'polling'],
  });

  NotificationService.setSocketIO(io);

  // Optional: Redis adapter for multi-instance
  try {
    const { pubClient, subClient } = await getRedisPubSub();
    if (pubClient && subClient) {
      const { createAdapter } = require('@socket.io/redis-adapter');
      io.adapter(createAdapter(pubClient, subClient));
      logInfo('✅ Socket.IO Redis adapter enabled');
    } else {
      logInfo('⚠️  Redis not available — Socket.IO single-instance mode');
    }
  } catch (e) {
    logInfo('⚠️  Redis adapter disabled');
  }

  // ============================================
  // Auth middleware
  // ============================================
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) throw new Error('Authentication required');

      const decoded = jwt.verify(token, config.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          role: true,
          profileImage: true,
          isActive: true,
          status: true,
          deletedAt: true,
        },
      });

      if (!user || !user.isActive || user.deletedAt) {
        throw new Error('User not found or inactive');
      }
      if (user.status === 'BLOCKED') {
        throw new Error('Account blocked');
      }

      socket.data.user = user;
      socket.data.userId = user.id;

      next();
    } catch (error) {
      logError('Socket auth failed', error);
      next(new Error('Authentication failed'));
    }
  });

  // ============================================
  // Connection handler
  // ============================================
  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    const user = socket.data.user;

    logInfo(`🔌 Socket connected: ${userId} (${user.name})`);

    // Track connected user (multi-device)
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);
    setConnectedUsers(connectedUsers);

    // Join personal rooms
    socket.join(`user:${userId}`);
    socket.join(`role:${user.role}`);

    // Send unread notification count
    try {
      const unreadCount = await NotificationService.getUnreadCount(userId);
      socket.emit('notification:unread-count', { count: unreadCount });
    } catch (e) {
      logError('Failed to send unread count', e);
    }

    // Update user online status
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      });

      const girl = await prisma.girl.findUnique({ where: { userId } });
      if (girl) {
        await prisma.girl.update({
          where: { userId },
          data: { isOnline: true },
        });
      }
    } catch (e) {
      logError('Failed to update online status', e);
    }

    // Broadcast online status
    socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
      userId,
      name: user.name,
      role: user.role,
    });

    // Register handlers
    const socketHelpers = {
      getUserSocketId,
      isUserOnline,
      getConnectedUsers,
    };

    registerChatHandlers(io, socket, socketHelpers);
    registerCallHandlers(io, socket, socketHelpers);
    registerRateHandlers(io, socket); // ⭐ Rate handlers

    // Disconnect
    socket.on('disconnect', async () => {
      logInfo(`🔌 Socket disconnected: ${userId}`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }

      // Only mark offline if no more sockets
      if (!connectedUsers.has(userId)) {
        try {
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() },
          });

          const girl = await prisma.girl.findUnique({ where: { userId } });
          if (girl) {
            await prisma.girl.update({
              where: { userId },
              data: { isOnline: false },
            });
          }
        } catch (e) {
          logError('Failed to update offline status', e);
        }

        socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });
      }
    });
  });

  logInfo('✅ Socket.IO initialized');
  return io;
};

// ============================================
// ⭐ Rate-Specific Handlers
// ============================================
const registerRateHandlers = (io, socket) => {
  const userId = socket.data.userId;
  const user = socket.data.user;

  // Girl: Submit rate change request
  socket.on('rate:submit', async (data) => {
    try {
      io.to('role:ADMIN').emit('rate:pending-new', {
        girlId: userId,
        girlName: user.name,
        rates: data,
        timestamp: new Date(),
      });

      socket.emit('rate:submitted', { success: true, ...data });
    } catch (error) {
      logError('Rate submit failed', error);
      socket.emit('rate:error', { message: error.message });
    }
  });

  // Admin: Approve rate change
  socket.on('rate:approve', async (data) => {
    if (user.role !== 'ADMIN') return;

    try {
      io.to(`user:${data.girlUserId}`).emit('rate:approved', {
        rates: data.rates,
        approvedBy: user.name,
        timestamp: new Date(),
      });
    } catch (error) {
      logError('Rate approve failed', error);
    }
  });

  // Admin: Reject rate change
  socket.on('rate:reject', async (data) => {
    if (user.role !== 'ADMIN') return;

    try {
      io.to(`user:${data.girlUserId}`).emit('rate:rejected', {
        reason: data.reason,
        rejectedBy: user.name,
        timestamp: new Date(),
      });
    } catch (error) {
      logError('Rate reject failed', error);
    }
  });
};

// ============================================
// Helpers
// ============================================
const getIO = () => io;

const getConnectedUsers = () => Array.from(connectedUsers.keys());

const getUserSocketId = (userId) => {
  const sockets = connectedUsers.get(userId);
  return sockets ? Array.from(sockets)[0] : null;
};

const isUserOnline = (userId) => connectedUsers.has(userId);

// ============================================
// Public: Notify Rate Change (from services)
// ============================================
const notifyRateChange = (girlUserId, action, data) => {
  if (!io) return;
  io.to(`user:${girlUserId}`).emit(`rate:${action.toLowerCase()}`, data);
};

const notifyAdminRatePending = (girlUserId, data) => {
  if (!io) return;
  io.to('role:ADMIN').emit('rate:pending-new', {
    girlId: girlUserId,
    ...data,
    timestamp: new Date(),
  });
};

module.exports = {
  initSocket,
  getIO,
  getConnectedUsers,
  getUserSocketId,
  isUserOnline,
  notifyRateChange,
  notifyAdminRatePending,
};