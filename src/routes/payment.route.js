const express = require('express');
const PaymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');

const router = express.Router();

// Public (no auth)
router.post('/google-play/rtdn', PaymentController.handleRTDN);

// User routes
router.use(authenticate);

router.post(
  '/google-play/verify-subscription',
  idempotency,
  PaymentController.verifySubscription
);

router.post(
  '/google-play/verify-product',
  idempotency,
  PaymentController.verifyProductPurchase
);

module.exports = router;