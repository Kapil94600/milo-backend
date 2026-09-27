// ============================================
// Payment Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/response');

const createOrder = asyncHandler(async (req, res) => {
  const { packageId } = req.body;
  const order = await PaymentService.createOrder(req.user.id, packageId);
  return ApiResponse.success(res, order, 'Order created');
});

const verifyPayment = asyncHandler(async (req, res) => {
  const result = await PaymentService.verifyPayment(req.user.id, req.body);
  return ApiResponse.success(res, result, 'Payment verified');
});

const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const result = await PaymentService.handleWebhook(rawBody, signature);
  return res.json(result);
});

module.exports = { createOrder, verifyPayment, webhook };