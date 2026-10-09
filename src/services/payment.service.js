// ============================================
// Payment Service — Google Play Billing
// ============================================

const { google } = require('googleapis');
const { prisma } = require('../config/database');
const config = require('../config');
const AppError = require('../utils/AppError');
const WalletService = require('./wallet.service');
const { logInfo, logError } = require('../utils/logger');

class PaymentService {
  // ============================================
  // Google Play API client
  // ============================================
  static getAndroidPublisher() {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.GOOGLE_PLAY.SERVICE_ACCOUNT_EMAIL,
        private_key: config.GOOGLE_PLAY.PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    return google.androidpublisher({
      version: 'v3',
      auth,
    });
  }

  // ============================================
  // VERIFY SUBSCRIPTION (for coin packages or recurring)
  // ============================================
  static async verifySubscription(userId, data) {
    const { productId, purchaseToken, packageName } = data;

    if (!productId || !purchaseToken) {
      throw AppError.badRequest('productId and purchaseToken required');
    }

    try {
      const androidPublisher = this.getAndroidPublisher();

      // Verify with Google Play
      const response = await androidPublisher.purchases.subscriptions.get({
        packageName: packageName || config.GOOGLE_PLAY.PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken,
      });

      const purchase = response.data;

      // Check expiry time
      const expiryTime = parseInt(purchase.expiryTimeMillis);
      if (expiryTime < Date.now()) {
        throw AppError.badRequest('Subscription expired');
      }

      // Check if already processed
      const existing = await prisma.transaction.findFirst({
        where: {
          userId,
          referenceId: purchaseToken,
          status: 'COMPLETED',
        },
      });

      if (existing) {
        return { success: true, message: 'Already processed' };
      }

      // Find package by productId
      const pkg = await prisma.coinPackage.findFirst({
        where: { googlePlayProductId: productId, isActive: true },
      });

      if (!pkg) throw AppError.notFound('Package not found');

      const totalCoins = pkg.coins + (pkg.bonusCoins || 0);

      // Credit coins
      await prisma.$transaction(async (tx) => {
        let wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { userId, balance: 0, coins: 0 },
          });
        }

        await tx.wallet.update({
          where: { userId },
          data: {
            coins: { increment: totalCoins },
            totalEarned: { increment: totalCoins },
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { totalCoins: { increment: totalCoins } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            category: 'COIN_PURCHASE',
            amount: pkg.price,
            coins: totalCoins,
            description: `Purchase: ${pkg.name} (Google Play)`,
            status: 'COMPLETED',
            referenceId: purchaseToken,
            referenceModel: 'GooglePlay',
            gatewayResponse: {
              productId,
              purchaseToken,
              orderId: purchase.orderId,
              purchaseTime: purchase.startTimeMillis,
            },
          },
        });
      });

      logInfo(`Google Play purchase verified: ${productId} for user ${userId}`);
      return { success: true, coinsCredited: totalCoins };

    } catch (error) {
      logError('Google Play verification failed', error.message);
      throw AppError.badRequest(`Verification failed: ${error.message}`);
    }
  }

  // ============================================
  // VERIFY ONE-TIME PURCHASE (for consumable coins)
  // ============================================
  static async verifyProductPurchase(userId, data) {
    const { productId, purchaseToken, packageName } = data;

    if (!productId || !purchaseToken) {
      throw AppError.badRequest('productId and purchaseToken required');
    }

    try {
      const androidPublisher = this.getAndroidPublisher();

      const response = await androidPublisher.purchases.products.get({
        packageName: packageName || config.GOOGLE_PLAY.PACKAGE_NAME,
        productId,
        token: purchaseToken,
      });

      const purchase = response.data;

      // Check purchase state (0 = purchased)
      if (purchase.purchaseState !== 0) {
        throw AppError.badRequest('Purchase not completed');
      }

      // Check if already processed
      const existing = await prisma.transaction.findFirst({
        where: {
          userId,
          referenceId: purchaseToken,
          status: 'COMPLETED',
        },
      });

      if (existing) {
        return { success: true, message: 'Already processed' };
      }

      // Find package
      const pkg = await prisma.coinPackage.findFirst({
        where: { googlePlayProductId: productId, isActive: true },
      });

      if (!pkg) throw AppError.notFound('Package not found');

      const totalCoins = pkg.coins + (pkg.bonusCoins || 0);

      // Credit coins (same as subscription)
      await prisma.$transaction(async (tx) => {
        let wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { userId, balance: 0, coins: 0 },
          });
        }

        await tx.wallet.update({
          where: { userId },
          data: {
            coins: { increment: totalCoins },
            totalEarned: { increment: totalCoins },
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { totalCoins: { increment: totalCoins } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            category: 'COIN_PURCHASE',
            amount: pkg.price,
            coins: totalCoins,
            description: `Purchase: ${pkg.name} (Google Play)`,
            status: 'COMPLETED',
            referenceId: purchaseToken,
            referenceModel: 'GooglePlay',
            gatewayResponse: {
              productId,
              purchaseToken,
              orderId: purchase.orderId,
              purchaseTime: purchase.purchaseTimeMillis,
            },
          },
        });
      });

      return { success: true, coinsCredited: totalCoins };

    } catch (error) {
      logError('Google Play product verification failed', error.message);
      throw AppError.badRequest(`Verification failed: ${error.message}`);
    }
  }

  // ============================================
  // Handle RTDN (Real-time developer notifications)
  // ============================================
  static async handleRTDN(payload) {
    // यहाँ Google Cloud Pub/Sub से आने वाले notifications handle करो
    // (subscription renewals, cancellations, etc.)
    logInfo('RTDN received', payload);
    return { received: true };
  }
}

module.exports = PaymentService;