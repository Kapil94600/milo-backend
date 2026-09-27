// ============================================
// Wallet Validators — with multipart support
// ============================================

const Joi = require('joi');

const purchaseCoins = {
  body: Joi.object({
    packageId: Joi.string().required(),
    paymentInfo: Joi.object().optional().allow(null),
  }),
};

const requestWithdrawal = {
  body: Joi.object({
    amount: Joi.number().positive().required(),
    method: Joi.string().valid('BANK', 'UPI', 'PAYPAL').required(),
    accountName: Joi.string().max(100).allow(''),
    accountNumber: Joi.string().max(50).allow(''),
    ifscCode: Joi.string().max(20).allow(''),
    upiId: Joi.string().max(100).allow(''),
    bankName: Joi.string().max(100).allow(''),
  }),
};

const getTransactions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('CREDIT', 'DEBIT'),
    category: Joi.string().max(50),
  }),
};

// ============================================
// CREATE — very flexible for FormData
// ============================================
const createCoinPackage = {
  body: Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).allow(''),
    image: Joi.string().allow(''),
    coins: Joi.number().integer().positive().required(),
    bonusCoins: Joi.number().integer().min(0).default(0),
    price: Joi.number().positive().required(),
    currency: Joi.string().max(10).default('INR'),
    discount: Joi.number().min(0).max(100).default(0),
    isPopular: Joi.boolean().default(false),
    isActive: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).default(0),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// UPDATE — very flexible for FormData
// ============================================
const updateCoinPackage = {
  body: Joi.object({
    name: Joi.string().max(100),
    description: Joi.string().max(500).allow(''),
    image: Joi.string().allow(''),
    coins: Joi.number().integer().positive(),
    bonusCoins: Joi.number().integer().min(0),
    price: Joi.number().positive(),
    currency: Joi.string().max(10),
    discount: Joi.number().min(0).max(100),
    isPopular: Joi.boolean(),
    isActive: Joi.boolean(),
    order: Joi.number().integer().min(0),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),  // ✅ Removed .min(1)
};

const adminAddCoins = {
  body: Joi.object({
    userId: Joi.string().required(),
    coins: Joi.number().integer().positive().required(),
    reason: Joi.string().max(200),
  }),
};

const processWithdrawal = {
  body: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED', 'COMPLETED').required(),
    failureReason: Joi.string().max(500).allow(''),
  }),
};

module.exports = {
  purchaseCoins,
  requestWithdrawal,
  getTransactions,
  createCoinPackage,
  updateCoinPackage,
  adminAddCoins,
  processWithdrawal,
};