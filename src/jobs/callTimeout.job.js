// ============================================
// Call Timeout Cleanup Job — Bond
// Marks stuck INITIATED/CONNECTED calls as MISSED/ENDED
// ============================================

const { prisma } = require('../config/database');
const { logInfo, logError } = require('../utils/logger');

// Max time a call can stay INITIATED (no answer)
const INITIATED_TIMEOUT_MS = 60 * 1000; // 60 sec

// Max time a call can stay CONNECTED without activity update
const CONNECTED_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

const callTimeoutJob = async () => {
  const now = new Date();
  const startedAt = Date.now();

  let cleanedMissed = 0;
  let cleanedEnded = 0;
  let failed = 0;

  try {
    // ============================================
    // 1. INITIATED calls older than timeout → MISSED
    // ============================================
    const initiatedCutoff = new Date(now.getTime() - INITIATED_TIMEOUT_MS);

    const stuckInitiated = await prisma.call.findMany({
      where: {
        status: 'INITIATED',
        createdAt: { lt: initiatedCutoff },
        deletedAt: null,
      },
      select: { id: true, callerId: true, receiverId: true, type: true },
    });

    for (const call of stuckInitiated) {
      try {
        await prisma.call.update({
          where: { id: call.id },
          data: {
            status: 'MISSED',
            endedAt: now,
          },
        });

        // Emit socket event
        try {
          const { getIO } = require('../socket');
          const io = getIO();
          if (io) {
            io.to(`user:${call.callerId}`).emit('call:missed', {
              callId: call.id,
            });
            io.to(`user:${call.receiverId}`).emit('call:missed', {
              callId: call.id,
            });
          }
        } catch (e) {
          // socket may not be initialized
        }

        cleanedMissed++;
      } catch (e) {
        logError(`Failed to mark call ${call.id} as missed`, e);
        failed++;
      }
    }

    // ============================================
    // 2. CONNECTED calls older than max → END (with billing)
    // ============================================
    const connectedCutoff = new Date(now.getTime() - CONNECTED_TIMEOUT_MS);

    const stuckConnected = await prisma.call.findMany({
      where: {
        status: 'CONNECTED',
        startedAt: { lt: connectedCutoff },
        deletedAt: null,
      },
      select: {
        id: true,
        callerId: true,
        receiverId: true,
        type: true,
        coinRate: true,
        startedAt: true,
      },
    });

    const CallService = require('../services/call.service');

    for (const call of stuckConnected) {
      try {
        // Use service to properly end + bill
        await CallService.endCall(call.id, call.callerId);
        cleanedEnded++;
      } catch (e) {
        logError(`Failed to auto-end call ${call.id}`, e);
        failed++;
      }
    }

    const duration = Date.now() - startedAt;

    if (cleanedMissed > 0 || cleanedEnded > 0 || failed > 0) {
      logInfo(
        `📞 Call timeout cleanup: ${cleanedMissed} missed, ${cleanedEnded} ended, ${failed} failed (${duration}ms)`
      );
    }

    return {
      missed: cleanedMissed,
      ended: cleanedEnded,
      failed,
      duration,
    };
  } catch (error) {
    logError('Call timeout job failed', error);
    throw error;
  }
};

module.exports = { callTimeoutJob };