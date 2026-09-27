// ============================================
// Payment Routes
// ============================================

const express = require('express');
const PaymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

const router = express.Router();

// Webhook (raw body, no auth)
router.post('/webhook/razorpay', PaymentController.webhook);

// User routes
router.use(authenticate);
router.post('/create-order', idempotency, PaymentController.createOrder);
router.post('/verify', PaymentController.verifyPayment);

module.exports = router;