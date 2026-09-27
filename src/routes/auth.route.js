// ============================================
// Auth Routes
// ============================================

const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const AuthValidator = require('../validators/auth.validator');

const router = express.Router();

// ============================================
// Public routes
// ============================================

// Request OTP
router.post(
  '/request-otp',
  otpLimiter,
  validate(AuthValidator.requestOTP),
  AuthController.requestOTP
);

// Verify OTP (login/register)
router.post(
  '/verify-otp',
  authLimiter,
  validate(AuthValidator.verifyOTP),
  AuthController.verifyOTP
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
// Protected routes (require JWT)
// ============================================

// Logout
router.post('/logout', authenticate, AuthController.logout);

// Logout from all devices
router.post('/logout-all', authenticate, AuthController.logoutAll);

// Get current user
router.get('/me', authenticate, AuthController.me);

module.exports = router;