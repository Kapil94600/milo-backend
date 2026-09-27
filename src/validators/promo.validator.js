// ============================================
// Promo Validators (Joi)
// ============================================

const Joi = require('joi');

const createPromo = {
  body: Joi.object({
    code: Joi.string().alphanum().uppercase().min(3).max(30).required(),
    description: Joi.string().min(2).max(500).required(),
    // image is optional — can be file OR url
    image: Joi.string().uri().allow(''),
    type: Joi.string()
      .valid('PERCENTAGE', 'FIXED', 'FREE_COINS', 'FREE_SUBSCRIPTION')
      .required(),
    value: Joi.number().positive().required(),
    maxDiscount: Joi.number().positive().allow(null),
    minOrderAmount: Joi.number().min(0).default(0),
    maxUses: Joi.number().integer().min(0).default(0),
    perUserLimit: Joi.number().integer().min(1).default(1),
    startDate: Joi.date().iso().allow(null),
    endDate: Joi.date().iso().allow(null),
    isActive: Joi.boolean(),
    applicableRoles: Joi.array().items(
      Joi.string().valid('USER', 'GIRL', 'ADMIN')
    ),
    applicableProducts: Joi.array().items(
      Joi.string().valid('SUBSCRIPTION', 'COIN_PACKAGE', 'ALL')
    ),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

const updatePromo = {
  body: Joi.object({
    description: Joi.string().min(2).max(500),
    image: Joi.string().uri().allow(''),
    type: Joi.string().valid(
      'PERCENTAGE',
      'FIXED',
      'FREE_COINS',
      'FREE_SUBSCRIPTION'
    ),
    value: Joi.number().positive(),
    maxDiscount: Joi.number().positive().allow(null),
    minOrderAmount: Joi.number().min(0),
    maxUses: Joi.number().integer().min(0),
    perUserLimit: Joi.number().integer().min(1),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    isActive: Joi.boolean(),
    applicableRoles: Joi.array().items(
      Joi.string().valid('USER', 'GIRL', 'ADMIN')
    ),
    applicableProducts: Joi.array().items(
      Joi.string().valid('SUBSCRIPTION', 'COIN_PACKAGE', 'ALL')
    ),
  })
    .unknown(true)
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

const validatePromo = {
  query: Joi.object({
    amount: Joi.number().min(0).default(0),
  }),
};

const applyPromo = {
  body: Joi.object({
    amount: Joi.number().min(0).required(),
    orderId: Joi.string().allow(''),
  }),
};

const toggleStatus = {
  body: Joi.object({
    isActive: Joi.boolean().required(),
  }),
};

module.exports = {
  createPromo,
  updatePromo,
  validatePromo,
  applyPromo,
  toggleStatus,
};