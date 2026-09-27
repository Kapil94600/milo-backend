// ============================================
// Chat Validators (Joi)
// ============================================

const Joi = require('joi');

const createDirectChat = {
  body: Joi.object({
    userId: Joi.string().required(),
  }),
};

const createGroupChat = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    participants: Joi.array().items(Joi.string()).min(1).max(500).required(),
  }),
};

const sendMessage = {
  body: Joi.object({
    content: Joi.string().max(5000).allow(''),
    type: Joi.string().valid('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'FILE', 'STICKER').default('TEXT'),
    mediaUrl: Joi.string().uri().allow(null, ''),
    replyToId: Joi.string().allow(null, ''),
  }).or('content', 'mediaUrl'),
};

const editMessage = {
  body: Joi.object({
    content: Joi.string().min(1).max(5000).required(),
  }),
};

const addReaction = {
  body: Joi.object({
    reaction: Joi.string().min(1).max(10).required(),
  }),
};

const addParticipants = {
  body: Joi.object({
    participants: Joi.array().items(Joi.string()).min(1).max(500).required(),
  }),
};

const searchMessages = {
  query: Joi.object({
    q: Joi.string().min(2).max(100).required(),
    chatId: Joi.string().allow(''),
  }),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = {
  createDirectChat,
  createGroupChat,
  sendMessage,
  editMessage,
  addReaction,
  addParticipants,
  searchMessages,
  paginationQuery,
};