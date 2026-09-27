// ============================================
// Notification Service — Database + FCM Push + Email + Socket
// ============================================

const { prisma } = require('../config/database');
const FCMService = require('./fcm.service');
const EmailService = require('./email.service');
const { logInfo, logError, logWarn } = require('../utils/logger');

// Socket.IO instance (set by socket/index.js)
let ioInstance = null;

class NotificationService {
  // ============================================
  // Set Socket.IO instance (called on startup)
  // ============================================
  static setSocketIO(io) {
    ioInstance = io;
  }

  // ============================================
  // 1. CREATE NOTIFICATION (Main)
  // ============================================
  static async createNotification(userId, data) {
    try {
      // 1. Save to DB
      const notification = await prisma.notification.create({
        data: {
          userId,
          senderId: data.senderId || null,
          type: data.type || 'SYSTEM',
          title: data.title,
          body: data.body,
          image: data.image || null,
          data: data.data || {},
          action: data.action || null,
          actionData: data.actionData || {},
          priority: data.priority || 'NORMAL',
          channel: data.channel || 'IN_APP',
        },
      });

      // 2. Emit via Socket.IO (in-app real-time)
      if (ioInstance) {
        try {
          ioInstance.to(`user:${userId}`).emit('notification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            image: notification.image,
            data: notification.data,
            action: notification.action,
            actionData: notification.actionData,
            priority: notification.priority,
            createdAt: notification.createdAt,
          });
        } catch (e) {
          logError('Socket notification emit failed', e);
        }
      }

      // 3. Send Push (if channel includes PUSH or BOTH)
      if (data.channel === 'PUSH' || data.channel === 'BOTH') {
        FCMService.sendToUser(
          userId,
          {
            title: data.title,
            body: data.body,
            image: data.image,
            type: data.type,
          },
          {
            notificationId: notification.id,
            type: data.type,
            action: data.action,
            ...(data.data || {}),
          },
          { priority: data.priority }
        ).catch((e) => logError('FCM push failed', e));
      }

      // 4. Send Email (if channel includes EMAIL)
      if (data.channel === 'EMAIL' && data.email) {
        EmailService.send({
          to: data.email,
          subject: data.title,
          html: this.buildEmailHTML(data),
        }).catch((e) => logError('Email send failed', e));
      }

      return notification;
    } catch (error) {
      logError('createNotification failed', error);
      throw error;
    }
  }

  // ============================================
  // 2. Get My Notifications (paginated)
  // ============================================
  static async getMyNotifications(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // Alias for backward compat
  static async getUserNotifications(userId, options = {}) {
    return this.getMyNotifications(userId, options);
  }

  // ============================================
  // 3. Get Unread Count
  // ============================================
  static async getUnreadCount(userId) {
    return prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
  }

  // ============================================
  // 4. Mark As Read
  // ============================================
  static async markAsRead(notificationId, userId) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) return null;

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    // Emit via socket
    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('notification:read', {
        notificationId,
      });
    }

    return updated;
  }

  // ============================================
  // 5. Mark All As Read
  // ============================================
  static async markAllAsRead(userId) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('notification:read-all');
    }

    return result;
  }

  // ============================================
  // 6. Delete Notification (soft)
  // ============================================
  static async deleteNotification(notificationId, userId) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { deletedAt: new Date() },
    });

    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('notification:deleted', {
        notificationId,
      });
    }

    return result;
  }

  // ============================================
  // 7. Delete All Notifications
  // ============================================
  static async deleteAll(userId) {
    const result = await prisma.notification.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('notification:cleared');
    }

    return result;
  }

  // Alias
  static async deleteAllNotifications(userId) {
    return this.deleteAll(userId);
  }

  // ============================================
  // 8. Send to Single User (Admin)
  // ============================================
  static async sendToUser(userId, data) {
    return this.createNotification(userId, data);
  }

  // ============================================
  // 9. Send to Multiple Users (Admin)
  // ============================================
  static async sendBulk(userIds, data) {
    return this.sendToMultipleUsers(userIds, data);
  }

  static async sendToMultipleUsers(userIds, data) {
    const notifications = [];

    // Process in batches of 50 to avoid overload
    const BATCH_SIZE = 50;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((userId) =>
          this.createNotification(userId, { ...data, channel: 'IN_APP' })
        )
      );

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          notifications.push(r.value);
        } else {
          logError(`Notification to ${batch[idx]} failed`, r.reason);
        }
      });
    }

    // Send push to all tokens in one batch (efficient)
    if (data.channel === 'PUSH' || data.channel === 'BOTH') {
      try {
        const devices = await prisma.device.findMany({
          where: { userId: { in: userIds }, isActive: true },
          select: { token: true },
        });

        const tokens = devices.map((d) => d.token);

        // FCM batch send (max 500 per request)
        const FCM_BATCH = 500;
        for (let i = 0; i < tokens.length; i += FCM_BATCH) {
          const tokenBatch = tokens.slice(i, i + FCM_BATCH);
          await FCMService.sendToTokens(
            tokenBatch,
            {
              title: data.title,
              body: data.body,
              image: data.image,
              type: data.type,
            },
            {
              type: data.type,
              action: data.action,
              ...(data.data || {}),
            },
            { priority: data.priority }
          );
        }
      } catch (e) {
        logError('Bulk FCM push failed', e);
      }
    }

    return {
      sent: notifications.length,
      total: userIds.length,
      notifications,
    };
  }

  // ============================================
  // 10. Broadcast to All Users (Admin)
  // ============================================
  static async broadcast(data, role = null) {
    return this.broadcastToAllUsers(data, role);
  }

  static async broadcastToAllUsers(data, role = null) {
    const where = { isActive: true, deletedAt: null };
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);
    return this.sendToMultipleUsers(userIds, data);
  }

  // ============================================
  // 11. Chat Notification Helper
  // ============================================
  static async sendChatNotification(senderId, receiverId, message) {
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true, profileImage: true },
    });

    if (!sender) return null;

    return this.createNotification(receiverId, {
      type: 'CHAT',
      title: sender.name,
      body: message.content || '📷 Media',
      image: sender.profileImage,
      senderId,
      data: {
        chatId: message.chatId,
        messageId: message.id,
        senderId,
      },
      action: 'OPEN_CHAT',
      actionData: { chatId: message.chatId },
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 12. Call Notification Helper
  // ============================================
  static async sendCallNotification(callerId, receiverId, type) {
    const caller = await prisma.user.findUnique({
      where: { id: callerId },
      select: { name: true, profileImage: true },
    });

    if (!caller) return null;

    return this.createNotification(receiverId, {
      type: 'CALL',
      title: `Incoming ${type} Call`,
      body: `${caller.name} is calling you`,
      image: caller.profileImage,
      senderId: callerId,
      data: { callerId, callType: type },
      action: 'OPEN_CALL',
      actionData: { callerId, type },
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 13. Coin Notification Helper
  // ============================================
  static async sendCoinNotification(userId, amount, type, description = null) {
    return this.createNotification(userId, {
      type: 'COIN',
      title: `${type === 'CREDIT' ? '💰 Coins Received' : '📉 Coins Used'}`,
      body:
        description ||
        `You ${type === 'CREDIT' ? 'received' : 'used'} ${amount} coins`,
      data: { amount, type },
      action: 'OPEN_WALLET',
      channel: 'BOTH',
      priority: 'NORMAL',
    });
  }

  // ============================================
  // 14. Reward Notification Helper
  // ============================================
  static async sendRewardNotification(userId, reward, reason = null) {
    return this.createNotification(userId, {
      type: 'REWARD',
      title: '🎉 Reward Earned!',
      body: reason || `You earned ${reward} coins!`,
      data: { reward },
      action: 'OPEN_WALLET',
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 15. Promo Notification Helper
  // ============================================
  static async sendPromoNotification(userId, promo) {
    return this.createNotification(userId, {
      type: 'PROMO',
      title: promo.title || '🎁 Special Offer!',
      body: promo.description || 'Check out our latest promotion',
      image: promo.image || null,
      data: { promoId: promo.id, code: promo.code },
      action: 'OPEN_SUBSCRIPTION',
      channel: 'BOTH',
      priority: 'NORMAL',
    });
  }

  // ============================================
  // 16. Girl Request Notification
  // ============================================
  static async sendGirlRequestNotification(userId, status, reason = null) {
    const titles = {
      APPROVED: '🎉 Approved!',
      REJECTED: '❌ Request Rejected',
    };

    const bodies = {
      APPROVED:
        'Your girl registration has been approved! You can now start earning.',
      REJECTED:
        reason ||
        'Your girl registration was not approved. You can try again later.',
    };

    return this.createNotification(userId, {
      type: 'SYSTEM',
      title: titles[status] || 'Girl Request Update',
      body: bodies[status] || 'Your request status has been updated.',
      data: { status },
      action: 'OPEN_PROFILE',
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 17. Gift Notification Helper
  // ============================================
  static async sendGiftNotification(
    receiverId,
    senderId,
    gift,
    isAnonymous = false
  ) {
    let senderName = 'Someone';
    let senderImage = null;

    if (!isAnonymous) {
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, profileImage: true },
      });
      if (sender) {
        senderName = sender.name;
        senderImage = sender.profileImage;
      }
    }

    return this.createNotification(receiverId, {
      type: 'REWARD',
      title: '🎁 You received a gift!',
      body: `${senderName} sent you ${gift.name}`,
      image: gift.image || senderImage,
      senderId: isAnonymous ? null : senderId,
      data: { giftId: gift.id, giftName: gift.name },
      action: 'OPEN_GIFT',
      actionData: { giftId: gift.id },
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 18. Withdrawal Notification Helper
  // ============================================
  static async sendWithdrawalNotification(
    userId,
    amount,
    status,
    reason = null
  ) {
    const statusMap = {
      APPROVED: { title: '✅ Withdrawal Approved' },
      REJECTED: { title: '❌ Withdrawal Rejected' },
      COMPLETED: { title: '💰 Withdrawal Complete' },
    };

    const info = statusMap[status] || { title: 'Withdrawal Update' };

    let body = `Your withdrawal of ₹${amount} has been ${status.toLowerCase()}.`;
    if (status === 'REJECTED' && reason) {
      body += ` Reason: ${reason}`;
    }

    return this.createNotification(userId, {
      type: 'SYSTEM',
      title: info.title,
      body,
      data: { amount, status, reason },
      action: 'OPEN_WALLET',
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 19. Subscription Notification Helper
  // ============================================
  static async sendSubscriptionNotification(
    userId,
    plan,
    status = 'ACTIVATED'
  ) {
    const titles = {
      ACTIVATED: '👑 Subscription Activated',
      EXPIRING: '⏰ Subscription Expiring Soon',
      EXPIRED: '❌ Subscription Expired',
      RENEWED: '🔄 Subscription Renewed',
    };

    return this.createNotification(userId, {
      type: 'SYSTEM',
      title: titles[status] || 'Subscription Update',
      body: `Your ${plan.name} plan has been ${status.toLowerCase()}.`,
      data: { planId: plan.id, status },
      action: 'OPEN_SUBSCRIPTION',
      channel: 'BOTH',
      priority: 'HIGH',
    });
  }

  // ============================================
  // 20. Email HTML Builder
  // ============================================
  static buildEmailHTML(data) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #E11D48, #7C3AED); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .content h2 { color: #0F172A; margin-top: 0; }
            .content p { color: #475569; line-height: 1.6; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Vibe</h1>
            </div>
            <div class="content">
              <h2>${data.title}</h2>
              <p>${data.body}</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Vibe. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = NotificationService;