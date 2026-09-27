// ============================================
// Admin Validators (Joi)
// ============================================

const Joi = require('joi');

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const getUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).allow(''),
    role: Joi.string().valid('USER', 'GIRL', 'ADMIN'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'),
  }),
};

const getGirls = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).allow(''),
    isVerified: Joi.string().valid('true', 'false'),
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
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED'),
  }).min(1),
};

const getTransactions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('CREDIT', 'DEBIT'),
    category: Joi.string(),
    userId: Joi.string(),
  }),
};

const getWithdrawals = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'),
  }),
};

const updateSetting = {
  body: Joi.object({
    value: Joi.any().required(),
  }),
};

const createSetting = {
  body: Joi.object({
    key: Joi.string().required(),
    value: Joi.any().required(),
    type: Joi.string().valid('STRING', 'NUMBER', 'BOOLEAN', 'OBJECT', 'ARRAY').required(),
    category: Joi.string().required(),
    description: Joi.string().allow(''),
    isEditable: Joi.boolean().default(true),
  }),
};

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

module.exports = {
  paginationQuery,
  getUsers,
  getGirls,
  updateUserStatus,
  blockUser,
  verifyGirl,
  updateGirl,
  getTransactions,
  getWithdrawals,
  updateSetting,
  createSetting,
  updateAdmin,
};