// ============================================
// Admin Validators (Joi) — Bond (Complete)
// ============================================

const Joi = require('joi');

// ============================================
// Common Pagination
// ============================================
const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

// ============================================
// USERS
// ============================================
const getUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).allow(''),
    role: Joi.string().valid('USER', 'GIRL', 'ADMIN'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'),
  }),
};

const updateUserStatus = {
  body: Joi.object({
    isActive: Joi.boolean(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED'),
  }).min(1),
};

const blockUser = {
  body: Joi.object({
    reason: Joi.string().max(500).allow(''),
  }),
};

// ============================================
// GIRLS
// ============================================
const getGirls = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).allow(''),
    isVerified: Joi.string().valid('true', 'false'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'),
    rateApproved: Joi.string().valid('true', 'false'),
  }),
};

const verifyGirl = {
  body: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  }),
};

const updateGirl = {
  body: Joi.object({
    isAvailable: Joi.boolean(),
    isOnline: Joi.boolean(),
    acceptChat: Joi.boolean(),
    acceptCalls: Joi.boolean(),
    isVerified: Joi.boolean(),
    isFeatured: Joi.boolean(),
    categories: Joi.array().items(Joi.string().max(50)),
    languages: Joi.array().items(Joi.string().max(50)),
    specialties: Joi.array().items(Joi.string().max(50)),
    about: Joi.string().max(1000).allow(''),
    hourlyRate: Joi.number().min(0),
    videoCallRate: Joi.number().min(0),
    chatMessageRate: Joi.number().min(0),
    rateApproved: Joi.boolean(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED'),
  }).min(1),
};

// ============================================
// RATE MANAGEMENT
// ============================================
const processRateChange = {
  body: Joi.object({
    action: Joi.string().valid('APPROVED', 'REJECTED').required(),
  }),
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

const updateGlobalRates = {
  body: Joi.object({
    messageCost: Joi.number().min(0),
    mediaCost: Joi.number().min(0),
    girlEarningPercent: Joi.number().min(0).max(100),
    voiceCallRate: Joi.number().min(0),
    videoCallRate: Joi.number().min(0),
    platformCommission: Joi.number().min(0).max(100),
    minCoinsForVideo: Joi.number().min(0),
  }).min(1),
};

// ============================================
// ⭐ PAYOUT RATES (NEW)
// ============================================
const updatePayoutRates = {
  body: Joi.object({
    coinToRupeeRate: Joi.number().positive().max(1000),
    girlPayoutPercent: Joi.number().min(0).max(100),
    minWithdrawalAmount: Joi.number().min(0),
    withdrawalFeePercent: Joi.number().min(0).max(100),
  }).min(1),
};

// ============================================
// WALLET
// ============================================
const getTransactions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('CREDIT', 'DEBIT'),
    category: Joi.string().max(50),
    userId: Joi.string().max(50),
  }),
};

const getWithdrawals = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'),
  }),
};

// ============================================
// ⭐ REFUND (NEW)
// ============================================
const processRefund = {
  body: Joi.object({
    transactionId: Joi.string().required(),
    reason: Joi.string().max(500).allow('', null),
  }),
};

// ============================================
// SETTINGS
// ============================================
const updateSetting = {
  body: Joi.object({
    value: Joi.any().required(),
  }),
};

const createSetting = {
  body: Joi.object({
    key: Joi.string().required(),
    value: Joi.any().required(),
    type: Joi.string()
      .valid('STRING', 'NUMBER', 'BOOLEAN', 'OBJECT', 'ARRAY')
      .required(),
    category: Joi.string().required(),
    description: Joi.string().allow(''),
    isEditable: Joi.boolean().default(true),
  }),
};

// ============================================
// ADMINS
// ============================================
const updateAdmin = {
  body: Joi.object({
    role: Joi.string().valid('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
    canManageUsers: Joi.boolean(),
    canManageGirls: Joi.boolean(),
    canManageCoins: Joi.boolean(),
    canManagePayments: Joi.boolean(),
    canManageSubscriptions: Joi.boolean(),
    canManageSettings: Joi.boolean(),
    canManageReports: Joi.boolean(),
    canManageNotifications: Joi.boolean(),
    canViewAnalytics: Joi.boolean(),
    canManageAdmins: Joi.boolean(),
  }).min(1),
};

// ============================================
// ANALYTICS
// ============================================
const getAnalytics = {
  query: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
  }),
};

// ============================================
// ⭐ SUB-ADMIN (NEW)
// ============================================
const createSubAdmin = {
  body: Joi.object({
    phone: Joi.string().pattern(/^\d{10,15}$/).required(),
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(50).required(),
    role: Joi.string().valid('ADMIN', 'MODERATOR').default('MODERATOR'),
    permissions: Joi.object({
      canManageUsers: Joi.boolean(),
      canManageGirls: Joi.boolean(),
      canManageCoins: Joi.boolean(),
      canManagePayments: Joi.boolean(),
      canManageSubscriptions: Joi.boolean(),
      canManageSettings: Joi.boolean(),
      canManageReports: Joi.boolean(),
      canManageNotifications: Joi.boolean(),
      canViewAnalytics: Joi.boolean(),
    }),
  }),
};

const updateSubAdminPermissions = {
  body: Joi.object({
    canManageUsers: Joi.boolean(),
    canManageGirls: Joi.boolean(),
    canManageCoins: Joi.boolean(),
    canManagePayments: Joi.boolean(),
    canManageSubscriptions: Joi.boolean(),
    canManageSettings: Joi.boolean(),
    canManageReports: Joi.boolean(),
    canManageNotifications: Joi.boolean(),
    canViewAnalytics: Joi.boolean(),
  }).min(1),
};
// ============================================
// Exports
// ============================================
module.exports = {
  // Common
  paginationQuery,

  // Users
  getUsers,
  updateUserStatus,
  blockUser,

  // Girls
  getGirls,
  verifyGirl,
  updateGirl,

  // Rate Management
  processRateChange,
  updateGlobalRates,

  // ⭐ Payout Rates
  updatePayoutRates,

  // Wallet
  getTransactions,
  getWithdrawals,

  // ⭐ Refund
  processRefund,

  // Settings
  updateSetting,
  createSetting,

  // Admins
  updateAdmin,

  // Analytics
  getAnalytics,
  createSubAdmin,
  updateSubAdminPermissions,
};