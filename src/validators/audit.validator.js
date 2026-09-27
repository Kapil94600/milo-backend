// ============================================
// Audit Validators (Joi)
// ============================================

const Joi = require('joi');

const getLogs = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    userId: Joi.string(),
    action: Joi.string(),
    resource: Joi.string(),
    resourceId: Joi.string(),
    status: Joi.string().valid('SUCCESS', 'FAILED'),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
  }),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
  }),
};

module.exports = { getLogs, paginationQuery };