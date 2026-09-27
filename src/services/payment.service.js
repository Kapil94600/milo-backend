// ============================================
// Payment Service — Razorpay
// ============================================

const crypto = require('crypto');
const { prisma } = require('../config/database');
const config = require('../config');
const AppError = require('../utils/AppError');
const WalletService = require('./wallet.service');
const { initRazorpay } = require('../config/razorpay');
const { logInfo, logError } = require('../utils/logger');

class PaymentService {
  // ============================================
  // 1. CREATE ORDER (for coin package)
  // ============================================
  static async createOrder(userId, packageId) {
    const razorpay = initRazorpay();
    if (!razorpay) throw AppError.badRequest('Payment gateway not configured');

    const pkg = await prisma.coinPackage.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw AppError.notFound('Package not found');

    const amountInPaise = Math.round(pkg.price * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `pkg_${packageId}_${Date.now()}`,
      notes: {
        userId,
        packageId,
        coins: String(pkg.coins + (pkg.bonusCoins || 0)),
      },
    });

    // Save pending transaction
    await prisma.transaction.create({
      data: {
        userId,
        type: 'CREDIT',
        category: 'COIN_PURCHASE',
        amount: pkg.price,
        coins: pkg.coins + (pkg.bonusCoins || 0),
        description: `Purchase: ${pkg.name}`,
        status: 'PENDING',
        referenceId: order.id,
        referenceModel: 'RazorpayOrder',
        gatewayResponse: { razorpayOrderId: order.id },
      },
    });

    logInfo(`Order created: ${order.id} for user ${userId}`);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.RAZORPAY.KEY_ID,
      packageName: pkg.name,
      coins: pkg.coins + (pkg.bonusCoins || 0),
    };
  }

  // ============================================
  // 2. VERIFY PAYMENT (client callback)
  // ============================================
  static async verifyPayment(userId, data) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw AppError.badRequest('Missing payment details');
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY.KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await prisma.transaction.updateMany({
        where: { referenceId: razorpay_order_id },
        data: { status: 'FAILED', failureReason: 'Invalid signature' },
      });
      throw AppError.badRequest('Payment verification failed');
    }

    // Find transaction
    const transaction = await prisma.transaction.findFirst({
      where: { referenceId: razorpay_order_id, userId },
    });

    if (!transaction) throw AppError.notFound('Transaction not found');

    if (transaction.status === 'COMPLETED') {
      return { success: true, message: 'Already credited' };
    }

    // Credit coins atomically
    const coinsToCredit = transaction.coins;

    await prisma.$transaction(async (tx) => {
      // Update transaction
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          gatewayResponse: {
            ...(transaction.gatewayResponse || {}),
            razorpayPaymentId: razorpay_payment_id,
            verifiedAt: new Date().toISOString(),
          },
        },
      });

      // Update wallet
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, coins: 0 },
        });
      }

      await tx.wallet.update({
        where: { userId },
        data: {
          coins: { increment: coinsToCredit },
          totalEarned: { increment: transaction.amount },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { totalCoins: { increment: coinsToCredit } },
      });
    });

    logInfo(`Payment verified: ${razorpay_payment_id} — ${coinsToCredit} coins credited`);

    return {
      success: true,
      coinsCredited: coinsToCredit,
      message: `${coinsToCredit} coins added to your wallet`,
    };
  }

  // ============================================
  // 3. WEBHOOK HANDLER
  // ============================================
  static async handleWebhook(rawBody, signature) {
    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY.WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw AppError.badRequest('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString());
    logInfo(`Webhook received: ${event.event}`);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const transaction = await prisma.transaction.findFirst({
        where: { referenceId: orderId, status: 'PENDING' },
      });

      if (transaction) {
        // Credit if not already done
        await this.verifyPayment(transaction.userId, {
          razorpay_order_id: orderId,
          razorpay_payment_id: payment.id,
          razorpay_signature: signature,
        });
      }
    } else if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      await prisma.transaction.updateMany({
        where: { referenceId: payment.order_id },
        data: {
          status: 'FAILED',
          failureReason: payment.error_description || 'Payment failed',
        },
      });
    }

    return { received: true };
  }
}

module.exports = PaymentService;