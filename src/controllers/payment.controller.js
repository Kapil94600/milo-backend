const asyncHandler = require('../utils/asyncHandler');
const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/response');

// POST /payments/google-play/verify-subscription
const verifySubscription = asyncHandler(async (req, res) => {
  const result = await PaymentService.verifySubscription(req.user.id, req.body);
  return ApiResponse.success(res, result, 'Subscription verified');
});

// POST /payments/google-play/verify-product
const verifyProductPurchase = asyncHandler(async (req, res) => {
  const result = await PaymentService.verifyProductPurchase(req.user.id, req.body);
  return ApiResponse.success(res, result, 'Product verified');
});

// POST /payments/google-play/rtdn (webhook)
const handleRTDN = asyncHandler(async (req, res) => {
  const result = await PaymentService.handleRTDN(req.body);
  return res.json(result);
});

module.exports = { verifySubscription, verifyProductPurchase, handleRTDN };