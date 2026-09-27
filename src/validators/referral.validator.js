// ============================================
// Referral Validators (Joi)
// ============================================

const Joi = require('joi');

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'COMPLETED', 'EXPIRED', 'REWARDED'),
  }),
};

const rewardReferral = {
  body: Joi.object({
    bonusCoins: Joi.number().integer().positive().default(50),
  }),
};

module.exports = { paginationQuery, rewardReferral };