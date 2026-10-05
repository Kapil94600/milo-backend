// ============================================
// FCM Service — Firebase Cloud Messaging
// ============================================

const admin = require('firebase-admin');
const config = require('../config');
const { prisma } = require('../config/database');
const { logInfo, logError, logWarn } = require('../utils/logger');

let fcmReady = false;
let fcmInitialized = false;

// ============================================
// Initialize Firebase Admin SDK (lazy)
// ============================================
const initFCM = () => {
  if (fcmInitialized) return fcmReady;
  fcmInitialized = true;

  const { PROJECT_ID, PRIVATE_KEY, CLIENT_EMAIL } = config.FIREBASE;

  if (!PROJECT_ID || !PRIVATE_KEY || !CLIENT_EMAIL) {
    logWarn('FCM disabled — Firebase credentials missing');
    fcmReady = false;
    return false;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: PROJECT_ID,
          privateKey: PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: CLIENT_EMAIL,
        }),
      });
    }

    fcmReady = true;
    logInfo('✅ Firebase Admin SDK initialized');
    return true;
  } catch (error) {
    logError('FCM initialization failed', error);
    fcmReady = false;
    return false;
  }
};

// ============================================
// FCM Service
// ============================================
class FCMService {
  static isAvailable() {
    if (!fcmInitialized) initFCM();
    return fcmReady;
  }

  // ============================================
  // Get user's device tokens
  // ============================================
  static async getUserTokens(userId) {
    const devices = await prisma.device.findMany({
      where: { userId, isActive: true },
      select: { id: true, token: true, platform: true },
    });
    return devices;
  }

  // ============================================
  // Send to single device
  // ============================================
  static async sendToToken(token, notification, data = {}, options = {}) {
    if (!this.isAvailable()) {
      logWarn('FCM not available — skipping push');
      return { success: false, reason: 'FCM_NOT_AVAILABLE' };
    }

    try {
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.image || undefined,
        },
        data: this.stringifyData(data),
        android: {
          priority: options.priority === 'HIGH' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(notification.type),
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: 'default',
              badge: options.badge || 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      return this.handleFCMSendError(error, token);
    }
  }

  // ============================================
  // Send to multiple devices (batch)
  // ============================================
  static async sendToTokens(tokens, notification, data = {}, options = {}) {
    if (!this.isAvailable()) {
      logWarn('FCM not available — skipping push');
      return { success: false, reason: 'FCM_NOT_AVAILABLE' };
    }

    if (!tokens || tokens.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    try {
      const message = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.image || undefined,
        },
        data: this.stringifyData(data),
        android: {
          priority: options.priority === 'HIGH' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(notification.type),
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: 'default',
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokens, response.responses);
      }

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
        responses: response.responses,
      };
    } catch (error) {
      logError('FCM batch send failed', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Send to user (all devices)
  // ============================================
  static async sendToUser(userId, notification, data = {}, options = {}) {
    if (!this.isAvailable()) return { success: false, reason: 'FCM_NOT_AVAILABLE' };

    const devices = await this.getUserTokens(userId);
    if (devices.length === 0) {
      return { success: true, sent: 0, reason: 'NO_DEVICES' };
    }

    const tokens = devices.map((d) => d.token);
    return this.sendToTokens(tokens, notification, data, options);
  }

  // ============================================
  // Send to topic (broadcast)
  // ============================================
  static async sendToTopic(topic, notification, data = {}) {
    if (!this.isAvailable()) {
      return { success: false, reason: 'FCM_NOT_AVAILABLE' };
    }

    try {
      const message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.image || undefined,
        },
        data: this.stringifyData(data),
      };

      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      logError('FCM topic send failed', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Subscribe tokens to topic
  // ============================================
  static async subscribeToTopic(tokens, topic) {
    if (!this.isAvailable()) return { success: false };
    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      return { success: true, ...response };
    } catch (error) {
      logError('FCM subscribe failed', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Unsubscribe from topic
  // ============================================
  static async unsubscribeFromTopic(tokens, topic) {
    if (!this.isAvailable()) return { success: false };
    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      return { success: true, ...response };
    } catch (error) {
      logError('FCM unsubscribe failed', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Validate token
  // ============================================
  static async validateToken(token) {
    if (!this.isAvailable()) return false;
    try {
      await admin.messaging().send(
        { token, data: { test: 'true' } },
        true
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // Helpers
  // ============================================
  static stringifyData(data) {
    const result = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (value === null || value === undefined) continue;
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  static getChannelId(type) {
    const map = {
      CHAT: 'chat_messages',
      CALL: 'calls',
      COIN: 'coins',
      SYSTEM: 'system',
      PROMO: 'promotions',
      REWARD: 'rewards',
    };
    return map[type] || 'default';
  }

  // ============================================
  // Error handling
  // ============================================
  static async handleFCMSendError(error, token) {
    const code = error.code || error.errorInfo?.code;

    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      try {
        await prisma.device.updateMany({
          where: { token },
          data: { isActive: false },
        });
        logWarn(`FCM invalid token removed: ${token.substring(0, 20)}...`);
      } catch (e) {
        logError('Failed to deactivate invalid token', e);
      }
    }

    logError('FCM send error', { code, message: error.message });
    return { success: false, error: code || error.message };
  }

  static async handleFailedTokens(tokens, responses) {
    const failedTokens = [];
    responses.forEach((resp, index) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          failedTokens.push(tokens[index]);
        }
      }
    });

    if (failedTokens.length > 0) {
      try {
        await prisma.device.updateMany({
          where: { token: { in: failedTokens } },
          data: { isActive: false },
        });
        logWarn(`FCM removed ${failedTokens.length} invalid tokens`);
      } catch (e) {
        logError('Failed to deactivate batch tokens', e);
      }
    }
  }
}

module.exports = FCMService;