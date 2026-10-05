// ============================================
// Payment Routes — Bond (with rate limiting)
// ============================================

const express = require('express');
const PaymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { createLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ⭐ Rate limiters
const paymentLimiter = createLimiter(
  15, // 15 minutes
  10, // 10 requests
  'Too many payment attempts. Please try again later.'
);

const verifyLimiter = createLimiter(
  15,
  20,
  'Too many verification attempts. Please try again later.'
);

// ============================================
// Webhook (raw body, no auth, no rate limit)
// ============================================
router.post('/webhook/razorpay', PaymentController.webhook);

// ============================================
// User routes
// ============================================
router.use(authenticate);

// ⭐ Create order — rate limited
router.post(
  '/create-order',
  paymentLimiter,
  idempotency,
  PaymentController.createOrder
);

// ⭐ Verify — rate limited
router.post(
  '/verify',
  verifyLimiter,
  PaymentController.verifyPayment
);

module.exports = router;