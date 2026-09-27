// ============================================
// Enums (mirror of Prisma enums for JS use)
// ============================================

const Role = {
  USER: 'USER',
  GIRL: 'GIRL',
  ADMIN: 'ADMIN',
};

const Status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  DELETED: 'DELETED',
};

const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
};

const Platform = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  WEB: 'WEB',
  ALL: 'ALL',
};

const TransactionType = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
};

const TransactionCategory = {
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
};

const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};

const WithdrawStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
};

const NotificationType = {
  CHAT: 'CHAT',
  CALL: 'CALL',
  COIN: 'COIN',
  SYSTEM: 'SYSTEM',
  PROMO: 'PROMO',
  REWARD: 'REWARD',
};

const NotificationChannel = {
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  BOTH: 'BOTH',
};

const NotificationPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
};

const CallType = {
  VOICE: 'VOICE',
  VIDEO: 'VIDEO',
};

const CallStatus = {
  INITIATED: 'INITIATED',
  CONNECTED: 'CONNECTED',
  ENDED: 'ENDED',
  MISSED: 'MISSED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
};

const CallQuality = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  GIF: 'GIF',
  FILE: 'FILE',
  STICKER: 'STICKER',
};

const ChatType = {
  DIRECT: 'DIRECT',
  GROUP: 'GROUP',
};

const ReportType = {
  USER: 'USER',
  MESSAGE: 'MESSAGE',
  CHAT: 'CHAT',
  CALL: 'CALL',
  PROFILE: 'PROFILE',
  PAYMENT: 'PAYMENT',
  OTHER: 'OTHER',
};

const ReportStatus = {
  PENDING: 'PENDING',
  REVIEWED: 'REVIEWED',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
};

const ReportPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

const ReportAction = {
  WARNING: 'WARNING',
  SUSPEND: 'SUSPEND',
  BAN: 'BAN',
  DELETE: 'DELETE',
  IGNORE: 'IGNORE',
  OTHER: 'OTHER',
};

const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

const GiftCategory = {
  FLOWERS: 'FLOWERS',
  HEARTS: 'HEARTS',
  STARS: 'STARS',
  ANIMALS: 'ANIMALS',
  FOOD: 'FOOD',
  LUXURY: 'LUXURY',
  EMOJI: 'EMOJI',
  SPECIAL: 'SPECIAL',
  OTHER: 'OTHER',
};

const GiftRarity = {
  COMMON: 'COMMON',
  UNCOMMON: 'UNCOMMON',
  RARE: 'RARE',
  EPIC: 'EPIC',
  LEGENDARY: 'LEGENDARY',
};

const SubscriptionDuration = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
};

const PromoType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
  FREE_COINS: 'FREE_COINS',
  FREE_SUBSCRIPTION: 'FREE_SUBSCRIPTION',
};

const ReferralStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  REWARDED: 'REWARDED',
};

const SupportCategory = {
  ACCOUNT: 'ACCOUNT',
  PAYMENT: 'PAYMENT',
  TECHNICAL: 'TECHNICAL',
  REPORT: 'REPORT',
  FEEDBACK: 'FEEDBACK',
  WITHDRAWAL: 'WITHDRAWAL',
  COINS: 'COINS',
  CALLS: 'CALLS',
  CHAT: 'CHAT',
  SUBSCRIPTION: 'SUBSCRIPTION',
  OTHER: 'OTHER',
};

const SupportStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
};

const MaintenanceType = {
  SCHEDULED: 'SCHEDULED',
  EMERGENCY: 'EMERGENCY',
  UPDATE: 'UPDATE',
};

const BannerLinkType = {
  URL: 'URL',
  PAGE: 'PAGE',
  PRODUCT: 'PRODUCT',
  USER: 'USER',
  GIRL: 'GIRL',
  SUBSCRIPTION: 'SUBSCRIPTION',
  COIN_PACKAGE: 'COIN_PACKAGE',
  NONE: 'NONE',
};

const AuthAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  REFRESH: 'REFRESH',
  OTP_REQUEST: 'OTP_REQUEST',
  OTP_VERIFY: 'OTP_VERIFY',
};

const AuditStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

const GirlRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// ============================================
// OTP_PURPOSE
// ============================================
const OTP_PURPOSE = {
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
  RESET_PASSWORD: 'RESET_PASSWORD',
  VERIFY_PHONE: 'VERIFY_PHONE',
};

// ============================================
// Alias — for backward compatibility
// ============================================
const ROLES = Role;

module.exports = {
  // Enums
  Role,
  Status,
  Gender,
  Platform,
  TransactionType,
  TransactionCategory,
  PaymentStatus,
  WithdrawStatus,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  CallType,
  CallStatus,
  CallQuality,
  MessageType,
  ChatType,
  ReportType,
  ReportStatus,
  ReportPriority,
  ReportAction,
  VerificationStatus,
  GiftCategory,
  GiftRarity,
  SubscriptionDuration,
  PromoType,
  ReferralStatus,
  SupportCategory,
  SupportStatus,
  MaintenanceType,
  BannerLinkType,
  AuthAction,
  AuditStatus,
  GirlRequestStatus,
  OTP_PURPOSE,

  // Alias
  ROLES,
};