// ============================================
// Application Constants — Complete
// ============================================

module.exports = {
  // ============================================
  // ROLES
  // ============================================
  ROLES: {
    USER: 'USER',
    GIRL: 'GIRL',
    ADMIN: 'ADMIN',
  },

  ADMIN_ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MODERATOR: 'MODERATOR',
  },

  // ============================================
  // STATUS
  // ============================================
  STATUS: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    BLOCKED: 'BLOCKED',
    DELETED: 'DELETED',
  },

  // ============================================
  // HTTP STATUS CODES
  // ============================================
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },

  // ============================================
  // CALL
  // ============================================
  CALL_TYPES: {
    VOICE: 'VOICE',
    VIDEO: 'VIDEO',
  },

  CALL_STATUS: {
    INITIATED: 'INITIATED',
    CONNECTED: 'CONNECTED',
    ENDED: 'ENDED',
    MISSED: 'MISSED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
  },

  // Alias
  CallStatus: {
    INITIATED: 'INITIATED',
    CONNECTED: 'CONNECTED',
    ENDED: 'ENDED',
    MISSED: 'MISSED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
  },

  // ============================================
  // MESSAGE
  // ============================================
  MESSAGE_TYPES: {
    TEXT: 'TEXT',
    IMAGE: 'IMAGE',
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO',
    GIF: 'GIF',
    FILE: 'FILE',
    STICKER: 'STICKER',
  },

  CHAT_TYPES: {
    DIRECT: 'DIRECT',
    GROUP: 'GROUP',
  },

  // ============================================
  // NOTIFICATION
  // ============================================
  NOTIFICATION_TYPES: {
    CHAT: 'CHAT',
    CALL: 'CALL',
    COIN: 'COIN',
    SYSTEM: 'SYSTEM',
    PROMO: 'PROMO',
    REWARD: 'REWARD',
  },

  NOTIFICATION_CHANNELS: {
    IN_APP: 'IN_APP',
    PUSH: 'PUSH',
    EMAIL: 'EMAIL',
    SMS: 'SMS',
    BOTH: 'BOTH',
  },

  // ============================================
  // TRANSACTION
  // ============================================
  TRANSACTION_TYPES: {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT',
  },

  TRANSACTION_CATEGORIES: {
    SIGNUP_BONUS: 'SIGNUP_BONUS',
    REFERRAL_BONUS: 'REFERRAL_BONUS',
    DAILY_BONUS: 'DAILY_BONUS',
    COIN_PURCHASE: 'COIN_PURCHASE',
    SUBSCRIPTION: 'SUBSCRIPTION',
    MESSAGE_COST: 'MESSAGE_COST',
    VOICE_CALL: 'VOICE_CALL',
    VIDEO_CALL: 'VIDEO_CALL',
    CALL_EARNING: 'CALL_EARNING',
    CHAT_EARNING: 'CHAT_EARNING',
    GIFT_SENT: 'GIFT_SENT',
    GIFT_RECEIVED: 'GIFT_RECEIVED',
    WITHDRAWAL: 'WITHDRAWAL',
    REFUND: 'REFUND',
    PROMO_CODE: 'PROMO_CODE',
    REWARD: 'REWARD',
    ADMIN_ADD: 'ADMIN_ADD',
  },

  // ============================================
  // PAYMENT
  // ============================================
  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },

  WITHDRAW_STATUS: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
  },

  // ============================================
  // PLATFORM
  // ============================================
  PLATFORM: {
    ANDROID: 'ANDROID',
    IOS: 'IOS',
    WEB: 'WEB',
    ALL: 'ALL',
  },

  // ============================================
  // REPORT
  // ============================================
  REPORT_STATUS: {
    PENDING: 'PENDING',
    REVIEWED: 'REVIEWED',
    RESOLVED: 'RESOLVED',
    REJECTED: 'REJECTED',
  },

  REPORT_PRIORITY: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },

  // ============================================
  // SUPPORT
  // ============================================
  SUPPORT_STATUS: {
    OPEN: 'OPEN',
    IN_PROGRESS: 'IN_PROGRESS',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED',
    REOPENED: 'REOPENED',
  },

  SUPPORT_PRIORITY: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },

  // ============================================
  // OTP
  // ============================================
  OTP_PURPOSE: {
    LOGIN: 'LOGIN',
    REGISTER: 'REGISTER',
    RESET_PASSWORD: 'RESET_PASSWORD',
    VERIFY_PHONE: 'VERIFY_PHONE',
  },

  // ============================================
  // PAGINATION
  // ============================================
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // ============================================
  // SOCKET EVENTS
  // ============================================
  SOCKET_EVENTS: {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ERROR: 'error',

    // User status
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',

    // Chat
    CHAT_JOIN: 'chat:join',
    CHAT_LEAVE: 'chat:leave',
    CHAT_JOINED: 'chat:joined',
    CHAT_LEFT: 'chat:left',
    CHAT_MESSAGE: 'chat:message',
    CHAT_OPENED: 'chat:opened',
    CHAT_NEW_MESSAGE: 'chat:new-message',
    MESSAGE_DELIVERED: 'message:delivered',
    MESSAGE_SEEN: 'message:seen',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',

    // Call
    CALL_INITIATE: 'call:initiate',
    CALL_INCOMING: 'call:incoming',
    CALL_ACCEPT: 'call:accept',
    CALL_ACCEPTED: 'call:accepted',
    CALL_REJECT: 'call:reject',
    CALL_REJECTED: 'call:rejected',
    CALL_END: 'call:end',
    CALL_ENDED: 'call:ended',
    CALL_MISSED: 'call:missed',
    CALL_CANCEL: 'call:cancel',
    CALL_CANCELLED: 'call:cancelled',
    CALL_USER_OFFLINE: 'call:user-offline',
    CALL_BUSY: 'call:busy',
    CALL_INITIATED: 'call:initiated',

    // Voice-specific
    CALL_VOICE_INCOMING: 'call:voice:incoming',
    CALL_VOICE_ACCEPTED: 'call:voice:accepted',
    CALL_VOICE_REJECTED: 'call:voice:rejected',
    CALL_VOICE_ENDED: 'call:voice:ended',

    // Video-specific
    CALL_VIDEO_INCOMING: 'call:video:incoming',
    CALL_VIDEO_ACCEPTED: 'call:video:accepted',
    CALL_VIDEO_REJECTED: 'call:video:rejected',
    CALL_VIDEO_ENDED: 'call:video:ended',
    CALL_VIDEO_BLOCKED: 'call:video:blocked',

    // WebRTC
    WEBRTC_OFFER: 'webrtc:offer',
    WEBRTC_ANSWER: 'webrtc:answer',
    WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',

    // Notification
    NOTIFICATION: 'notification',

    // ⭐ Rate Events
    RATE_SUBMIT: 'rate:submit',
    RATE_SUBMITTED: 'rate:submitted',
    RATE_APPROVED: 'rate:approved',
    RATE_REJECTED: 'rate:rejected',
    RATE_PENDING_NEW: 'rate:pending-new',
    RATE_ERROR: 'rate:error',
  },
};