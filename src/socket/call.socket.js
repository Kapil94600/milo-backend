// ============================================
// Call Socket Handlers (Signaling + WebRTC)
// ============================================

const CallService = require('../services/call.service');
const { logInfo, logError } = require('../utils/logger');
const { SOCKET_EVENTS, CallStatus } = require('../common/constants');

// Auto-mark missed calls after 30 sec
const MISSED_TIMEOUT_MS = 30000;
const pendingMissTimers = new Map(); // callId -> setTimeout

// ============================================
// Register Call Handlers
// ============================================
const registerCallHandlers = (io, socket, helpers) => {
  const userId = socket.data.userId;
  const user = socket.data.user;
  const { getUserSocketId } = helpers;

  // ============================================
  // INITIATE CALL
  // ============================================
  socket.on(SOCKET_EVENTS.CALL_INITIATE, async (data) => {
    try {
      const { receiverId, type = 'VOICE', quality = 'MEDIUM' } = data;

      // Create call in DB
      const call = await CallService.initiateCall(userId, receiverId, type, quality);

      // Find receiver's socket
      const receiverSocketId = getUserSocketId(receiverId);

      if (!receiverSocketId) {
        // Receiver offline
        await CallService.endCall(call.id, userId);
        socket.emit(SOCKET_EVENTS.CALL_USER_OFFLINE, { callId: call.id });
        return;
      }

      // Notify receiver — use consistent event naming
      const incomingEvent =
        type === 'VIDEO'
          ? SOCKET_EVENTS.CALL_VIDEO_INCOMING
          : SOCKET_EVENTS.CALL_VOICE_INCOMING;

      io.to(receiverSocketId).emit(incomingEvent, {
        callId: call.id,
        callerId: userId,
        callerName: user.name,
        callerImage: user.profileImage,
        type,
        quality,
      });

      // Notify caller
      socket.emit(SOCKET_EVENTS.CALL_INITIATED, {
        callId: call.id,
        receiverId,
        type,
        quality,
        coinRate: call.coinRate,
      });

      // Set missed-call timeout
      const timer = setTimeout(async () => {
        try {
          const c = await CallService.markAsMissed(call.id);
          if (c && c.status === CallStatus.MISSED) {
            // Notify both
            socket.emit(SOCKET_EVENTS.CALL_MISSED, { callId: call.id });
            io.to(receiverSocketId).emit(SOCKET_EVENTS.CALL_MISSED, { callId: call.id });
          }
        } catch (e) {
          logError('Missed timer error', e);
        }
        pendingMissTimers.delete(call.id);
      }, MISSED_TIMEOUT_MS);

      pendingMissTimers.set(call.id, timer);

      logInfo(`Call initiated via socket: ${call.id}`);
    } catch (error) {
      logError('Call initiate error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================
  // ACCEPT CALL
  // ============================================
  socket.on(SOCKET_EVENTS.CALL_ACCEPT, async (data) => {
    try {
      const { callId, callerId } = data;

      // Clear missed timer
      if (pendingMissTimers.has(callId)) {
        clearTimeout(pendingMissTimers.get(callId));
        pendingMissTimers.delete(callId);
      }

      const call = await CallService.acceptCall(callId, userId);

      // Notify caller
      const callerSocketId = getUserSocketId(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit(SOCKET_EVENTS.CALL_ACCEPTED, {
          callId,
          receiverId: userId,
        });
      }

      logInfo(`Call accepted via socket: ${callId}`);
    } catch (error) {
      logError('Call accept error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================
  // REJECT CALL
  // ============================================
  socket.on(SOCKET_EVENTS.CALL_REJECT, async (data) => {
    try {
      const { callId, callerId } = data;

      if (pendingMissTimers.has(callId)) {
        clearTimeout(pendingMissTimers.get(callId));
        pendingMissTimers.delete(callId);
      }

      await CallService.rejectCall(callId, userId);

      const callerSocketId = getUserSocketId(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit(SOCKET_EVENTS.CALL_REJECTED, {
          callId,
          receiverId: userId,
        });
      }

      logInfo(`Call rejected via socket: ${callId}`);
    } catch (error) {
      logError('Call reject error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================
  // END CALL
  // ============================================
  socket.on(SOCKET_EVENTS.CALL_END, async (data) => {
    try {
      const { callId, targetUserId } = data;

      if (pendingMissTimers.has(callId)) {
        clearTimeout(pendingMissTimers.get(callId));
        pendingMissTimers.delete(callId);
      }

      const call = await CallService.endCall(callId, userId);

      // Notify other party
      const targetSocketId = getUserSocketId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit(SOCKET_EVENTS.CALL_ENDED, {
          callId,
          endedBy: userId,
          duration: call.duration,
          cost: call.cost,
        });
      }

      // Confirm to self
      socket.emit(SOCKET_EVENTS.CALL_ENDED, {
        callId,
        endedBy: userId,
        duration: call.duration,
        cost: call.cost,
      });

      logInfo(`Call ended via socket: ${callId}`);
    } catch (error) {
      logError('Call end error', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================
  // CANCEL CALL (before accept)
  // ============================================
  socket.on(SOCKET_EVENTS.CALL_CANCEL, async (data) => {
    try {
      const { callId, receiverId } = data;

      if (pendingMissTimers.has(callId)) {
        clearTimeout(pendingMissTimers.get(callId));
        pendingMissTimers.delete(callId);
      }

      await CallService.cancelCall(callId, userId);

      const receiverSocketId = getUserSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit(SOCKET_EVENTS.CALL_CANCELLED, {
          callId,
          callerId: userId,
        });
      }
    } catch (error) {
      logError('Call cancel error', error);
    }
  });

  // ============================================
  // WEBRTC SIGNALING
  // ============================================
  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (data) => {
    const { targetUserId, offer, callId } = data;
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
        from: userId,
        offer,
        callId,
      });
    }
  });

  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (data) => {
    const { targetUserId, answer, callId } = data;
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
        from: userId,
        answer,
        callId,
      });
    }
  });

  socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (data) => {
    const { targetUserId, candidate, callId } = data;
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
        from: userId,
        candidate,
        callId,
      });
    }
  });
};

module.exports = { registerCallHandlers };