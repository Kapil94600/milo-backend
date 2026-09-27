// ============================================
// Auth Validators (Joi)
// ============================================

const Joi = require('joi');
const { J } = require('../middleware/validate');

// ============================================
// POST /auth/request-otp
// ============================================
const requestOTP = {
  body: Joi.object({
    phone: J.phone.required(),
  }),
};

// ============================================
// POST /auth/verify-otp
// ============================================
const verifyOTP = {
  body: Joi.object({
    phone: J.phone.required(),
    otp: J.otp.required(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().max(100).allow('', null),
      platform: Joi.string().valid('ios', 'android', 'web', 'unknown').allow('', null),
      version: Joi.string().max(20).allow('', null),
      model: Joi.string().max(50).allow('', null),
      fcmToken: Joi.string().max(500).allow('', null),
    })
      .optional()
      .allow(null)
      .allow(''),
  }),
};

// ============================================
// POST /auth/refresh-token
// ============================================
const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

// ============================================
// POST /auth/create-admin
// ============================================
const createAdmin = {
  body: Joi.object({
    phone: J.phone.required(),
    email: J.email.required(),
    name: Joi.string().trim().min(2).max(50).required(),
    password: Joi.string().min(6).max(100).required(),
    secretKey: Joi.string().required(),
  }),
};

// ============================================
// PUT /auth/update-fcm-token
// ============================================
const updateFcmToken = {
  body: Joi.object({
    fcmToken: Joi.string().required().max(500),
    platform: Joi.string().valid('ios', 'android', 'web').optional(),
  }),
};

module.exports = {
  requestOTP,
  verifyOTP,
  refreshToken,
  createAdmin,
  updateFcmToken,
};