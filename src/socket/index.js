// ============================================
// Socket.IO Setup — Bond (Full Auth)
// ============================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../config/database');
const { getRedisPubSub } = require('../config/redis');
const { logInfo, logError, logWarn } = require('../utils/logger');
const { SOCKET_EVENTS } = require('../common/constants');
const { registerChatHandlers, setConnectedUsers } = require('./chat.socket');
const { registerCallHandlers } = require('./call.socket');
const NotificationService = require('../services/notification.service');

let io = null;
const connectedUsers = new Map();

// ============================================
// ⭐ Socket Event Auth Guard
// ============================================
const requireAuthSocket = (socket, handler) => {
  return async (...args) => {
    // Verify user is still authenticated
    if (!socket.data.userId || !socket.data.user) {
      logWarn('Socket event from unauthenticated user');
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    // Verify user is still active (DB check every 100 events or on sensitive)
    const now = Date.now();
    if (!socket.data.lastAuthCheck || now - socket.data.lastAuthCheck > 60000) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: socket.data.userId },
          select: { id: true, isActive: true, status: true, deletedAt: true },
        });

        if (!user || !user.isActive || user.deletedAt || user.status === 'BLOCKED') {
          logWarn(`Socket auth failed for user ${socket.data.userId} — disconnecting`);
          socket.emit('error', { message: 'Account inactive' });
          socket.disconnect(true);
          return;
        }

        socket.data.lastAuthCheck = now;
      } catch (e) {
        logError('Socket auth check failed', e);
      }
    }

    return handler(...args);
  };
};

// ============================================
// Wrap register handler to apply auth guard
// ============================================
const applyAuthGuard = (socket) => {
  const originalOn = socket.on.bind(socket);

  socket.on = (event, handler) => {
    // Skip system events
    const systemEvents = ['disconnect', 'error', 'connect'];
    if (systemEvents.includes(event)) {
      return originalOn(event, handler);
    }

    // Wrap with auth guard
    return originalOn(event, requireAuthSocket(socket, handler));
  };

  return socket;
};

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
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  NotificationService.setSocketIO(io);

  // Redis adapter
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
  // Auth middleware (connection)
  // ============================================
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!token) throw new Error('Authentication required');

      const decoded = jwt.verify(token, config.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          role: true,
          profileImage: true,
          phone: true,
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
      socket.data.lastAuthCheck = Date.now();

      next();
    } catch (error) {
      logError('Socket auth failed', error.message);
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

    // ⭐ Apply per-event auth guard
    applyAuthGuard(socket);

    // Track connected user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);
    setConnectedUsers(connectedUsers);

    // Join rooms
    socket.join(`user:${userId}`);
    socket.join(`role:${user.role}`);

    // Send unread count
    try {
      const unreadCount = await NotificationService.getUnreadCount(userId);
      socket.emit('notification:unread-count', { count: unreadCount });
    } catch (e) {
      logError('Failed to send unread count', e);
    }

    // Update online status
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

    // Broadcast online
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
      getIO,
    };

    registerChatHandlers(io, socket, socketHelpers);
    registerCallHandlers(io, socket, socketHelpers);
    registerRateHandlers(io, socket);

    // Pending call pickup
    try {
      const pendingCall = await prisma.call.findFirst({
        where: {
          receiverId: userId,
          status: 'INITIATED',
          createdAt: { gte: new Date(Date.now() - 30000) },
        },
        include: {
          caller: {
            select: { id: true, name: true, profileImage: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingCall) {
        const incomingEvent =
          pendingCall.type === 'VIDEO'
            ? SOCKET_EVENTS.CALL_VIDEO_INCOMING
            : SOCKET_EVENTS.CALL_VOICE_INCOMING;

        socket.emit(incomingEvent, {
          callId: pendingCall.id,
          callerId: pendingCall.callerId,
          callerName: pendingCall.caller.name,
          callerImage: pendingCall.caller.profileImage,
          type: pendingCall.type,
          quality: pendingCall.quality,
          coinRate: pendingCall.coinRate,
        });

        logInfo(`📞 Delivered pending call ${pendingCall.id} to ${userId}`);
      }
    } catch (e) {
      logError('Pending call check failed', e);
    }

    // Disconnect
    socket.on('disconnect', async (reason) => {
      logInfo(`🔌 Socket disconnected: ${userId} (${reason})`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }

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

  logInfo('✅ Socket.IO initialized with per-event auth');
  return io;
};

// ============================================
// Rate Handlers
// ============================================
const registerRateHandlers = (io, socket) => {
  const userId = socket.data.userId;
  const user = socket.data.user;

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

const emitToUser = (userId, event, data) => {
  if (!io) return false;
  try {
    io.to(`user:${userId}`).emit(event, data);
    return true;
  } catch (e) {
    return false;
  }
};

// ============================================
// Exports
// ============================================
module.exports = {
  initSocket,
  getIO,
  getConnectedUsers,
  getUserSocketId,
  isUserOnline,
  notifyRateChange,
  notifyAdminRatePending,
  emitToUser,
};