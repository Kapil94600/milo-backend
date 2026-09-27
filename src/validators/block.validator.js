// ============================================
// Block Validators (Joi)
// ============================================

const Joi = require('joi');

const blockUser = {
  body: Joi.object({
    blockedId: Joi.string().required(),
    reason: Joi.string().max(500).allow('', null),
    expiresAt: Joi.date().iso().greater('now').allow(null),
  }),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = { blockUser, paginationQuery };