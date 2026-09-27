// ============================================
// Call Validators (Joi)
// ============================================

const Joi = require('joi');

const initiateCall = {
  body: Joi.object({
    receiverId: Joi.string().required(),
    type: Joi.string().valid('VOICE', 'VIDEO').default('VOICE'),
    quality: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
  }),
};

const getCallHistory = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('VOICE', 'VIDEO'),
    status: Joi.string().valid('INITIATED', 'CONNECTED', 'ENDED', 'MISSED', 'REJECTED', 'CANCELLED', 'FAILED'),
  }),
};

const saveRecording = {
  body: Joi.object({
    url: Joi.string().uri().required(),
    duration: Joi.number().min(0),
    size: Joi.number().min(0),
  }),
};

const updateCallRates = {
  body: Joi.object({
    voiceRate: Joi.number().positive(),
    videoRate: Joi.number().positive(),
    minCoinsForVideo: Joi.number().integer().min(0),  // ✅ NEW
  }).min(1),
};

module.exports = {
  initiateCall,
  getCallHistory,
  saveRecording,
  updateCallRates,
};