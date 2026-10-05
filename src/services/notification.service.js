// ============================================
// Notification Service — Bond (Complete with retry + batch fix)
// ============================================

const { prisma } = require('../config/database');
const FCMService = require('./fcm.service');
const EmailService = require('./email.service');
const { logInfo, logError, logWarn } = require('../utils/logger');

// Socket.IO instance
let ioInstance = null;

// ============================================
// BATCH CONFIG
// ============================================
const DB_BATCH_SIZE = 50; // DB insert per batch
const FCM_BATCH_SIZE = 500; // FCM send per batch
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

class NotificationService {
  // ============================================
  // Set Socket.IO instance
  // ============================================
  static setSocketIO(io) {
    ioInstance = io;
  }

  // ============================================
  // 1. CREATE NOTIFICATION (main)
  // ============================================
  static async createNotification(userId, data) {
    try {
      // Check user's notification preferences
      const shouldAllow = await this.checkUserPreference(userId, data.type);
      if (!shouldAllow) {
        logInfo(`Notification to ${userId} skipped (user preference)`);
        return null;
      }

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

      // Socket.IO — in-app real-time
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

      // Push (FCM) — with retry
      if (data.channel === 'PUSH' || data.channel === 'BOTH') {
        this.sendPushWithRetry(
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

      // Email
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
  // ⭐ Helper: Send push with retry
  // ============================================
  static async sendPushWithRetry(userId, notification, data, options = {}) {
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await FCMService.sendToUser(userId, notification, data, options);

        if (result.success) {
          return result;
        }

        // If it's a permanent failure (no devices), don't retry
        if (result.reason === 'NO_DEVICES' || result.reason === 'FCM_NOT_AVAILABLE') {
          return result;
        }

        // Otherwise wait and retry
        if (attempt < MAX_RETRY_ATTEMPTS) {
          logWarn(`FCM retry ${attempt}/${MAX_RETRY_ATTEMPTS} for user ${userId}`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      } catch (e) {
        logError(`FCM send attempt ${attempt} failed`, e);

        if (attempt >= MAX_RETRY_ATTEMPTS) {
          return { success: false, error: e.message };
        }

        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  // ============================================
  // ⭐ Helper: Check user preference
  // ============================================
  static async checkUserPreference(userId, type) {
    try {
      const prefs = await prisma.userPreference.findUnique({
        where: { userId },
        select: { notificationPreferences: true },
      });

      if (!prefs?.notificationPreferences) return true;

      const np = prefs.notificationPreferences;
      const typeKey = String(type).toLowerCase();

      // If explicitly disabled, skip
      if (np[typeKey] === false) return false;

      return true;
    } catch (e) {
      return true;
    }
  }

  // ============================================
  // 2. Get My Notifications
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
  // 6. Delete Notification
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
  // 7. Delete All
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

  // ============================================
  // 8. Send to Single User (admin)
  // ============================================
  static async sendToUser(userId, data) {
    return this.createNotification(userId, data);
  }

  // ============================================
  // 9. Send Bulk (with DB batching)
  // ============================================
  static async sendBulk(userIds, data) {
    return this.sendToMultipleUsers(userIds, data);
  }

  static async sendToMultipleUsers(userIds, data) {
    if (!userIds || userIds.length === 0) {
      return { sent: 0, total: 0, notifications: [] };
    }

    const notifications = [];
    const failedIds = [];

    // ⭐ Process in DB batches
    for (let i = 0; i < userIds.length; i += DB_BATCH_SIZE) {
      const batch = userIds.slice(i, i + DB_BATCH_SIZE);

      // Filter by preferences first
      const allowedBatch = await this.filterByPreferences(batch, data.type);

      const results = await Promise.allSettled(
        allowedBatch.map((userId) =>
          this.createNotification(userId, { ...data, channel: 'IN_APP' })
        )
      );

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          notifications.push(r.value);
        } else if (r.status === 'rejected') {
          failedIds.push(allowedBatch[idx]);
          logError(`Notification to ${allowedBatch[idx]} failed`, r.reason);
        }
      });

      // Small delay between batches to avoid overwhelming DB
      if (i + DB_BATCH_SIZE < userIds.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // ⭐ Send push in FCM batches
    if (data.channel === 'PUSH' || data.channel === 'BOTH') {
      try {
        const devices = await prisma.device.findMany({
          where: { userId: { in: userIds }, isActive: true },
          select: { token: true },
        });

        const tokens = devices.map((d) => d.token);

        for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
          const tokenBatch = tokens.slice(i, i + FCM_BATCH_SIZE);

          try {
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
          } catch (e) {
            logError(`FCM batch ${i / FCM_BATCH_SIZE + 1} failed`, e);
          }

          // Small delay between FCM batches
          if (i + FCM_BATCH_SIZE < tokens.length) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      } catch (e) {
        logError('Bulk FCM push failed', e);
      }
    }

    return {
      sent: notifications.length,
      failed: failedIds.length,
      total: userIds.length,
      notifications,
    };
  }

  // ============================================
  // ⭐ Helper: Filter users by notification preferences
  // ============================================
  static async filterByPreferences(userIds, type) {
    if (!type) return userIds;

    try {
      const prefs = await prisma.userPreference.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, notificationPreferences: true },
      });

      const prefsMap = {};
      prefs.forEach((p) => {
        prefsMap[p.userId] = p.notificationPreferences;
      });

      const typeKey = String(type).toLowerCase();

      return userIds.filter((userId) => {
        const np = prefsMap[userId];
        if (!np) return true;
        return np[typeKey] !== false;
      });
    } catch (e) {
      return userIds;
    }
  }

  // ============================================
  // 10. Broadcast
  // ============================================
  static async broadcast(data, role = null) {
    return this.broadcastToAllUsers(data, role);
  }

  static async broadcastToAllUsers(data, role = null) {
    const where = { isActive: true, deletedAt: null };
    if (role) where.role = role;

    // ⭐ Use cursor pagination to avoid loading all users
    const users = [];
    let cursor = null;
    const PAGE_SIZE = 1000;

    while (true) {
      const batch = await prisma.user.findMany({
        where,
        select: { id: true },
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (batch.length === 0) break;

      users.push(...batch.map((u) => u.id));
      cursor = batch[batch.length - 1].id;

      if (batch.length < PAGE_SIZE) break;
    }

    logInfo(`Broadcasting to ${users.length} users`);

    return this.sendToMultipleUsers(users, data);
  }

  // ============================================
  // 11-19. Helper notification methods
  // (Same as before, just keep them)
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

  static async sendCoinNotification(userId, amount, type, description = null) {
    return this.createNotification(userId, {
      type: 'COIN',
      title: `${type === 'CREDIT' ? '💰 Coins Received' : '📉 Coins Used'}`,
      body: description || `You ${type === 'CREDIT' ? 'received' : 'used'} ${amount} coins`,
      data: { amount, type },
      action: 'OPEN_WALLET',
      channel: 'BOTH',
      priority: 'NORMAL',
    });
  }

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

  static async sendGirlRequestNotification(userId, status, reason = null) {
    const titles = {
      APPROVED: '🎉 Approved!',
      REJECTED: '❌ Request Rejected',
    };

    const bodies = {
      APPROVED: 'Your girl registration has been approved! You can now start earning.',
      REJECTED: reason || 'Your girl registration was not approved. You can try again later.',
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

  static async sendGiftNotification(receiverId, senderId, gift, isAnonymous = false) {
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

  static async sendWithdrawalNotification(userId, amount, status, reason = null) {
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

  static async sendSubscriptionNotification(userId, plan, status = 'ACTIVATED') {
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
            .header { background: linear-gradient(135deg, #4C1D95, #7C3AED); padding: 30px; text-align: center; }
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
              <h1>Bond</h1>
            </div>
            <div class="content">
              <h2>${data.title}</h2>
              <p>${data.body}</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Bond. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
    // ============================================
  // ⭐ SCHEDULE NOTIFICATION (NEW)
  // ============================================
  static async scheduleNotification(adminId, data) {
    const {
      userIds,
      role,
      title,
      body,
      image,
      data: extraData,
      action,
      actionData,
      priority = 'NORMAL',
      channel = 'BOTH',
      type = 'SYSTEM',
      scheduledAt,
    } = data;

    if (!title || !body) {
      throw AppError.badRequest('Title and body are required');
    }

    if (!scheduledAt) {
      throw AppError.badRequest('scheduledAt is required');
    }

    const scheduledDate = new Date(scheduledAt);

    if (scheduledDate <= new Date()) {
      throw AppError.badRequest('scheduledAt must be in the future');
    }

    // Save scheduled notification
    const scheduled = await prisma.scheduledNotification.create({
      data: {
        adminId,
        userIds: userIds || [],
        role: role || null,
        title,
        body,
        image: image || null,
        data: extraData || {},
        action: action || null,
        actionData: actionData || {},
        priority,
        channel,
        type,
        scheduledAt: scheduledDate,
        status: 'PENDING',
      },
    });

    logInfo(
      `Notification scheduled by admin ${adminId} for ${scheduledDate.toISOString()} (${userIds?.length || 0} users, role: ${role || 'all'})`
    );

    return scheduled;
  }

  // ============================================
  // ⭐ GET SCHEDULED NOTIFICATIONS (NEW)
  // ============================================
  static async getScheduledNotifications({ page = 1, limit = 20, status } = {}) {
    const where = {};
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.scheduledNotification.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scheduledNotification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // ⭐ CANCEL SCHEDULED NOTIFICATION (NEW)
  // ============================================
  static async cancelScheduledNotification(id, adminId) {
    const notification = await prisma.scheduledNotification.findUnique({
      where: { id },
    });

    if (!notification) throw AppError.notFound('Scheduled notification not found');
    if (notification.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot cancel notification with status: ${notification.status}`);
    }

    const updated = await prisma.scheduledNotification.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    logInfo(`Scheduled notification cancelled: ${id} by admin ${adminId}`);
    return updated;
  }

  // ============================================
  // ⭐ GET NOTIFICATION HISTORY (NEW)
  // ============================================
  static async getNotificationHistory({ page = 1, limit = 20, type, status } = {}) {
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      prisma.notificationHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notificationHistory.count({ where }),
    ]);

    return {
      data: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // ⭐ RECORD NOTIFICATION HISTORY (helper)
  // ============================================
  static async recordHistory(data) {
    try {
      return await prisma.notificationHistory.create({
        data: {
          title: data.title,
          body: data.body,
          type: data.type || 'SYSTEM',
          channel: data.channel || 'IN_APP',
          recipientCount: data.recipientCount || 0,
          sentCount: data.sentCount || 0,
          failedCount: data.failedCount || 0,
          status: data.status || 'SENT',
          sentBy: data.sentBy || null,
          role: data.role || null,
          metadata: data.metadata || {},
        },
      });
    } catch (e) {
      logError('Failed to record notification history', e);
      return null;
    }
  }

  // ============================================
  // ⭐ SEND SCHEDULED NOTIFICATION (called by cron)
  // ============================================
  static async sendScheduledNotification(scheduledId) {
    const scheduled = await prisma.scheduledNotification.findUnique({
      where: { id: scheduledId },
    });

    if (!scheduled) throw AppError.notFound('Scheduled notification not found');
    if (scheduled.status !== 'PENDING') {
      return { skipped: true, reason: `Status is ${scheduled.status}` };
    }

    try {
      let result;

      // Send based on mode
      if (scheduled.userIds && scheduled.userIds.length > 0) {
        // Direct user list
        result = await this.sendToMultipleUsers(scheduled.userIds, {
          type: scheduled.type,
          title: scheduled.title,
          body: scheduled.body,
          image: scheduled.image,
          data: scheduled.data,
          action: scheduled.action,
          actionData: scheduled.actionData,
          priority: scheduled.priority,
          channel: scheduled.channel,
        });
      } else {
        // Broadcast (optionally filtered by role)
        result = await this.broadcastToAllUsers(
          {
            type: scheduled.type,
            title: scheduled.title,
            body: scheduled.body,
            image: scheduled.image,
            data: scheduled.data,
            action: scheduled.action,
            actionData: scheduled.actionData,
            priority: scheduled.priority,
            channel: scheduled.channel,
          },
          scheduled.role
        );
      }

      // Mark as sent
      await prisma.scheduledNotification.update({
        where: { id: scheduledId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          recipientCount: result.total || 0,
          sentCount: result.sent || 0,
          failedCount: result.failed || 0,
        },
      });

      // Record history
      await this.recordHistory({
        title: scheduled.title,
        body: scheduled.body,
        type: scheduled.type,
        channel: scheduled.channel,
        recipientCount: result.total || 0,
        sentCount: result.sent || 0,
        failedCount: result.failed || 0,
        status: 'SENT',
        sentBy: scheduled.adminId,
        role: scheduled.role,
        metadata: {
          scheduledId: scheduled.id,
        },
      });

      logInfo(`Scheduled notification sent: ${scheduledId}`);
      return { success: true, result };
    } catch (error) {
      // Mark as failed
      await prisma.scheduledNotification.update({
        where: { id: scheduledId },
        data: {
          status: 'FAILED',
          failureReason: error.message,
        },
      });

      logError(`Scheduled notification failed: ${scheduledId}`, error);
      throw error;
    }
  }
}

module.exports = NotificationService;