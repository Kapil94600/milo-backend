// ============================================
// Support Validators (Joi)
// ============================================

const Joi = require('joi');

const createTicket = {
  body: Joi.object({
    subject: Joi.string().min(5).max(200).required(),
    category: Joi.string()
      .valid('ACCOUNT', 'PAYMENT', 'TECHNICAL', 'REPORT', 'FEEDBACK', 'WITHDRAWAL', 'COINS', 'CALLS', 'CHAT', 'SUBSCRIPTION', 'OTHER')
      .required(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
    description: Joi.string().min(10).max(2000).required(),
    attachments: Joi.array().items(Joi.string().uri()).max(10),
  }),
};

const addMessage = {
  body: Joi.object({
    message: Joi.string().min(1).max(2000).required(),
    attachments: Joi.array().items(Joi.string().uri()).max(10),
    isInternal: Joi.boolean().default(false),
  }),
};

const rateTicket = {
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    feedback: Joi.string().max(500).allow(''),
  }),
};

const updateStatus = {
  body: Joi.object({
    status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED').required(),
    resolution: Joi.string().max(1000).allow(''),
  }),
};

const assignTicket = {
  body: Joi.object({
    adminId: Joi.string(),
  }),
};

module.exports = { createTicket, addMessage, rateTicket, updateStatus, assignTicket };