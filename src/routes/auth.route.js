// ============================================
// Auth Routes
// ============================================

const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const AuthValidator = require('../validators/auth.validator');
const Joi = require('joi');

const router = express.Router();

// ============================================
// Public routes
// ============================================

// Request OTP (legacy — MSG91)
router.post(
  '/request-otp',
  otpLimiter,
  validate(AuthValidator.requestOTP),
  AuthController.requestOTP
);

// Verify OTP (legacy — MSG91)
router.post(
  '/verify-otp',
  authLimiter,
  validate(AuthValidator.verifyOTP),
  AuthController.verifyOTP
);

// ✅ NEW: Firebase login
router.post(
  '/firebase-login',
  authLimiter,
  validate({
    body: Joi.object({
      idToken: Joi.string().required(),
      deviceInfo: Joi.object({
        deviceId: Joi.string().max(100).allow('', null),
        platform: Joi.string().valid('ios', 'android', 'web', 'unknown').allow('', null),
        version: Joi.string().max(20).allow('', null),
        model: Joi.string().max(50).allow('', null),
        fcmToken: Joi.string().max(500).allow('', null),
      })
        .optional()
        .allow(null),
    }),
  }),
  AuthController.firebaseLogin
);

// Refresh access token
router.post(
  '/refresh-token',
  validate(AuthValidator.refreshToken),
  AuthController.refreshToken
);

// Create admin (with secret key)
router.post(
  '/create-admin',
  authLimiter,
  validate(AuthValidator.createAdmin),
  AuthController.createAdmin
);

// ============================================
// Protected routes
// ============================================
router.post('/logout', authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.get('/me', authenticate, AuthController.me);

module.exports = router;