// ============================================
// Gift Validators — with multipart support
// ============================================

const Joi = require('joi');

const createGift = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).allow(''),
    image: Joi.string().allow(''),
    thumbnail: Joi.string().allow(''),
    animationUrl: Joi.string().allow(''),
    soundUrl: Joi.string().allow(''),
    coins: Joi.number().integer().positive().required(),
    price: Joi.number().min(0).required(),
    category: Joi.string().valid(
      'FLOWERS',
      'HEARTS',
      'STARS',
      'ANIMALS',
      'FOOD',
      'LUXURY',
      'EMOJI',
      'SPECIAL',
      'OTHER'
    ),
    rarity: Joi.string().valid('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    displayOrder: Joi.number().integer().min(0),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

const updateGift = {
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    description: Joi.string().max(500).allow(''),
    image: Joi.string().allow(''),
    thumbnail: Joi.string().allow(''),
    animationUrl: Joi.string().allow(''),
    soundUrl: Joi.string().allow(''),
    coins: Joi.number().integer().positive(),
    price: Joi.number().min(0),
    category: Joi.string().valid(
      'FLOWERS',
      'HEARTS',
      'STARS',
      'ANIMALS',
      'FOOD',
      'LUXURY',
      'EMOJI',
      'SPECIAL',
      'OTHER'
    ),
    rarity: Joi.string().valid('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    displayOrder: Joi.number().integer().min(0),
  })
    .unknown(true)
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

const sendGift = {
  body: Joi.object({
    receiverId: Joi.string().required(),
    giftId: Joi.string().required(),
    message: Joi.string().max(200).allow(''),
    isAnonymous: Joi.boolean().default(false),
    chatId: Joi.string().allow(null, ''),
  }),
};

const getTransactions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'),
    type: Joi.string().valid('sent', 'received'),
    giftId: Joi.string(),
  }),
};

const toggleStatus = {
  body: Joi.object({
    isActive: Joi.boolean().required(),
  }),
};

module.exports = {
  createGift,
  updateGift,
  sendGift,
  getTransactions,
  toggleStatus,
};