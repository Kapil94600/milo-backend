// ============================================
// Review Validators (Joi)
// ============================================

const Joi = require('joi');

const createReview = {
  body: Joi.object({
    reviewedId: Joi.string().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(1000).allow('', null),
    callId: Joi.string().allow(null, ''),
    isAnonymous: Joi.boolean().default(false),
  }),
};

const updateReview = {
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5),
    comment: Joi.string().max(1000).allow(''),
  }).min(1),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = { createReview, updateReview, paginationQuery };