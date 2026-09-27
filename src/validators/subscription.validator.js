// ============================================
// Subscription Validators — with multipart support
// ============================================

const Joi = require('joi');

const createPlan = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).allow(''),
    image: Joi.string().allow(''),
    price: Joi.number().positive().required(),
    currency: Joi.string().max(10).default('INR'),
    duration: Joi.string()
      .valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')
      .required(),
    durationDays: Joi.number().integer().positive().required(),
    features: Joi.array().items(Joi.string().max(100)).max(20),
    freeMessages: Joi.number().integer().min(0),
    freeVoiceMinutes: Joi.number().integer().min(0),
    freeVideoMinutes: Joi.number().integer().min(0),
    bonusCoins: Joi.number().integer().min(0),
    discountPercent: Joi.number().min(0).max(100),
    prioritySupport: Joi.boolean(),
    adFree: Joi.boolean(),
    isPopular: Joi.boolean(),
    isActive: Joi.boolean(),
    order: Joi.number().integer().min(0),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

const updatePlan = {
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    description: Joi.string().max(500).allow(''),
    image: Joi.string().allow(''),
    price: Joi.number().positive(),
    currency: Joi.string().max(10),
    duration: Joi.string().valid(
      'DAILY',
      'WEEKLY',
      'MONTHLY',
      'QUARTERLY',
      'YEARLY'
    ),
    durationDays: Joi.number().integer().positive(),
    features: Joi.array().items(Joi.string().max(100)).max(20),
    freeMessages: Joi.number().integer().min(0),
    freeVoiceMinutes: Joi.number().integer().min(0),
    freeVideoMinutes: Joi.number().integer().min(0),
    bonusCoins: Joi.number().integer().min(0),
    discountPercent: Joi.number().min(0).max(100),
    prioritySupport: Joi.boolean(),
    adFree: Joi.boolean(),
    isPopular: Joi.boolean(),
    isActive: Joi.boolean(),
    order: Joi.number().integer().min(0),
  })
    .unknown(true)
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

const subscribe = {
  body: Joi.object({
    planId: Joi.string().required(),
    autoRenew: Joi.boolean().default(false),
  }),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = {
  createPlan,
  updatePlan,
  subscribe,
  paginationQuery,
};