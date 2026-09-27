// ============================================
// Notification Validators (Joi)
// ============================================

const Joi = require('joi');

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const sendToUser = {
  body: Joi.object({
    userId: Joi.string().required(),
    type: Joi.string().valid('CHAT', 'CALL', 'COIN', 'SYSTEM', 'PROMO', 'REWARD').default('SYSTEM'),
    title: Joi.string().min(1).max(100).required(),
    body: Joi.string().min(1).max(500).required(),
    image: Joi.string().uri().allow(''),
    data: Joi.object().unknown(true),
    action: Joi.string().max(50),
    actionData: Joi.object().unknown(true),
    priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH').default('NORMAL'),
    channel: Joi.string().valid('IN_APP', 'PUSH', 'EMAIL', 'SMS', 'BOTH').default('BOTH'),
  }),
};

const sendBulk = {
  body: Joi.object({
    userIds: Joi.array().items(Joi.string()).min(1).max(10000).required(),
    type: Joi.string().valid('CHAT', 'CALL', 'COIN', 'SYSTEM', 'PROMO', 'REWARD').default('SYSTEM'),
    title: Joi.string().min(1).max(100).required(),
    body: Joi.string().min(1).max(500).required(),
    image: Joi.string().uri().allow(''),
    data: Joi.object().unknown(true),
    priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH').default('NORMAL'),
    channel: Joi.string().valid('IN_APP', 'PUSH', 'EMAIL', 'SMS', 'BOTH').default('BOTH'),
  }),
};

const broadcast = {
  body: Joi.object({
    role: Joi.string().valid('USER', 'GIRL', 'ADMIN'),
    type: Joi.string().valid('CHAT', 'CALL', 'COIN', 'SYSTEM', 'PROMO', 'REWARD').default('SYSTEM'),
    title: Joi.string().min(1).max(100).required(),
    body: Joi.string().min(1).max(500).required(),
    image: Joi.string().uri().allow(''),
    data: Joi.object().unknown(true),
    priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH').default('NORMAL'),
    channel: Joi.string().valid('IN_APP', 'PUSH', 'EMAIL', 'SMS', 'BOTH').default('BOTH'),
  }),
};

module.exports = { paginationQuery, sendToUser, sendBulk, broadcast };