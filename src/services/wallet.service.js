// ============================================
// Wallet Service — Complete (with CoinPackage image + proper type conversion)
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const UploadService = require('./upload.service');
const EmailService = require('./email.service');
const NotificationService = require('./notification.service');
const { logInfo, logError } = require('../utils/logger');

class WalletService {
  // ============================================
  // HELPER: Parse number safely
  // ============================================
  static parseNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return isNaN(n) ? fallback : n;
  }

  // ============================================
  // HELPER: Parse boolean safely
  // ============================================
  static parseBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return fallback;
  }

  // ============================================
  // 1. GET WALLET (or create)
  // ============================================
  static async getWallet(userId) {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId, balance: 0, coins: 0 },
      });
    }

    return wallet;
  }

  // ============================================
  // 2. GET TRANSACTIONS (paginated)
  // ============================================
  static async getTransactions(
    userId,
    { page = 1, limit = 20, type, category } = {}
  ) {
    const where = { userId, deletedAt: null };
    if (type) where.type = type;
    if (category) where.category = category;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 3. TRANSACTION STATS
  // ============================================
  static async getTransactionStats(userId) {
    const [creditCoins, debitCoins, creditMoney, debitMoney, totalTx] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: { userId, type: 'CREDIT', deletedAt: null },
          _sum: { coins: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: 'DEBIT', deletedAt: null },
          _sum: { coins: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: 'CREDIT', deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: 'DEBIT', deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.transaction.count({ where: { userId, deletedAt: null } }),
      ]);

    return {
      coinsEarned: creditCoins._sum.coins || 0,
      coinsSpent: debitCoins._sum.coins || 0,
      moneyEarned: creditMoney._sum.amount || 0,
      moneySpent: debitMoney._sum.amount || 0,
      totalTransactions: totalTx,
    };
  }

  // ============================================
  // 4. ADD COINS
  // ============================================
  static async addCoins(
    userId,
    coins,
    category,
    description,
    metadata = null
  ) {
    if (coins <= 0) throw AppError.badRequest('Coins must be positive');

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, coins: 0 },
        });
      }

      const updated = await tx.wallet.update({
        where: { userId },
        data: {
          coins: { increment: coins },
          totalEarned: { increment: coins },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { totalCoins: { increment: coins } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CREDIT',
          category,
          amount: 0,
          coins,
          description,
          status: 'COMPLETED',
          balanceAfter: updated.balance,
          coinsAfter: updated.coins,
          referenceId: metadata?.referenceId || null,
          referenceModel: metadata?.referenceModel || null,
          gatewayResponse: metadata || null,
        },
      });

      return updated;
    });

    logInfo(`+${coins} coins to ${userId} (${category})`);

   const notifyCategories = [
  'SIGNUP_BONUS',
  'REFERRAL_BONUS',
  'DAILY_BONUS',
  'ADMIN_ADD',
  'REWARD',
  'CALL_EARNING',
  'CHAT_EARNING',
];
    if (notifyCategories.includes(category)) {
      NotificationService.sendCoinNotification(
        userId,
        coins,
        'CREDIT',
        description
      ).catch(() => {});
    }

    return result;
  }

  // ============================================
  // 5. DEDUCT COINS
  // ============================================
  static async deductCoins(
    userId,
    coins,
    category,
    description,
    metadata = null
  ) {
    if (coins <= 0) throw AppError.badRequest('Coins must be positive');

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw AppError.notFound('Wallet not found');

      if (wallet.coins < coins) {
        throw AppError.badRequest('Insufficient coins');
      }

      const updated = await tx.wallet.update({
        where: { userId },
        data: {
          coins: { decrement: coins },
          totalSpent: { increment: coins },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { totalCoins: { decrement: coins } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEBIT',
          category,
          amount: 0,
          coins,
          description,
          status: 'COMPLETED',
          balanceAfter: updated.balance,
          coinsAfter: updated.coins,
          referenceId: metadata?.referenceId || null,
          referenceModel: metadata?.referenceModel || null,
          gatewayResponse: metadata || null,
        },
      });

      return updated;
    });

    logInfo(`-${coins} coins from ${userId} (${category})`);

    if (coins >= 100) {
      NotificationService.sendCoinNotification(
        userId,
        coins,
        'DEBIT',
        description
      ).catch(() => {});
    }

    return result;
  }

  // ============================================
  // 6. CHECK COIN BALANCE
  // ============================================
  static async hasEnoughCoins(userId, required) {
    if (required <= 0) return { hasEnough: true, balance: 0 };
    const wallet = await this.getWallet(userId);
    return {
      hasEnough: wallet.coins >= required,
      balance: wallet.coins,
      required,
    };
  }

  // ============================================
  // 7. ADD MONEY
  // ============================================
  static async addMoney(
    userId,
    amount,
    category,
    description,
    metadata = null
  ) {
    if (amount <= 0) throw AppError.badRequest('Amount must be positive');

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, coins: 0 },
        });
      }

      const updated = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          totalEarned: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CREDIT',
          category,
          amount,
          coins: 0,
          description,
          status: 'COMPLETED',
          balanceAfter: updated.balance,
          coinsAfter: updated.coins,
          referenceId: metadata?.referenceId || null,
          referenceModel: metadata?.referenceModel || null,
          gatewayResponse: metadata || null,
        },
      });

      return updated;
    });

    return result;
  }

  // ============================================
  // 8. DEDUCT MONEY
  // ============================================
  static async deductMoney(
    userId,
    amount,
    category,
    description,
    metadata = null
  ) {
    if (amount <= 0) throw AppError.badRequest('Amount must be positive');

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw AppError.notFound('Wallet not found');

      if (wallet.balance < amount) {
        throw AppError.badRequest('Insufficient balance');
      }

      const updated = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          totalSpent: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEBIT',
          category,
          amount,
          coins: 0,
          description,
          status: 'COMPLETED',
          balanceAfter: updated.balance,
          coinsAfter: updated.coins,
          referenceId: metadata?.referenceId || null,
          referenceModel: metadata?.referenceModel || null,
          gatewayResponse: metadata || null,
        },
      });

      return updated;
    });

    return result;
  }

  // ============================================
  // 9. COIN PACKAGES — Image resolve helper
  // ============================================
  static async resolvePackageImage(data) {
    if (data._uploadedFile) {
      const result = await UploadService.uploadFile(
        data._uploadedFile,
        'coin-packages'
      );
      return result.url;
    }
    if (data.image && typeof data.image === 'string' && data.image.trim()) {
      return data.image.trim();
    }
    return null;
  }

  // ============================================
  // 10. GET COIN PACKAGES
  // ============================================
  static async getCoinPackages(activeOnly = true) {
    const where = { deletedAt: null };
    if (activeOnly) where.isActive = true;

    return prisma.coinPackage.findMany({
      where,
      orderBy: [{ order: 'asc' }, { price: 'asc' }],
    });
  }

  static async getCoinPackageById(id) {
    const pkg = await prisma.coinPackage.findUnique({ where: { id } });
    if (!pkg || pkg.deletedAt) throw AppError.notFound('Package not found');
    return pkg;
  }

  // ============================================
  // 11. CREATE COIN PACKAGE — With explicit type conversion
  // ============================================
  static async createCoinPackage(data) {
    console.log('🔨 [CoinPackage Create] Raw data:', data);

    const imageUrl = await this.resolvePackageImage(data);

    const payload = {
      name: String(data.name || '').trim(),
      description: data.description ? String(data.description).trim() : null,
      image: imageUrl,
      coins: this.parseNumber(data.coins, 0),
      bonusCoins: this.parseNumber(data.bonusCoins, 0),
      price: this.parseNumber(data.price, 0),
      currency: String(data.currency || 'INR'),
      discount: this.parseNumber(data.discount, 0),
      isPopular: this.parseBoolean(data.isPopular, false),
      isActive: this.parseBoolean(data.isActive, true),
      order: this.parseNumber(data.order, 0),
    };

    console.log('✅ [CoinPackage Create] Parsed payload:', payload);

    return prisma.coinPackage.create({ data: payload });
  }

  // ============================================
  // 12. UPDATE COIN PACKAGE — With explicit type conversion
  // ============================================
  static async updateCoinPackage(id, data) {
    const existing = await prisma.coinPackage.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Package not found');

    console.log('🔨 [CoinPackage Update] Raw data:', data);
    console.log('📦 [CoinPackage Update] Existing:', existing);

    const updates = {};

    if (data.name !== undefined) updates.name = String(data.name).trim();
    if (data.description !== undefined) {
      updates.description = data.description
        ? String(data.description).trim()
        : null;
    }
    if (data.coins !== undefined) {
      updates.coins = this.parseNumber(data.coins, existing.coins);
    }
    if (data.bonusCoins !== undefined) {
      updates.bonusCoins = this.parseNumber(data.bonusCoins, existing.bonusCoins);
    }
    if (data.price !== undefined) {
      updates.price = this.parseNumber(data.price, existing.price);
    }
    if (data.currency !== undefined) {
      updates.currency = String(data.currency);
    }
    if (data.discount !== undefined) {
      updates.discount = this.parseNumber(data.discount, existing.discount);
    }
    if (data.isPopular !== undefined) {
      updates.isPopular = this.parseBoolean(data.isPopular, existing.isPopular);
    }
    if (data.isActive !== undefined) {
      updates.isActive = this.parseBoolean(data.isActive, existing.isActive);
    }
    if (data.order !== undefined) {
      updates.order = this.parseNumber(data.order, existing.order);
    }

    // Handle image (file OR url)
    if (data._uploadedFile || data.image !== undefined) {
      updates.image = await this.resolvePackageImage(data);
    }

    console.log('✅ [CoinPackage Update] Parsed updates:', updates);

    return prisma.coinPackage.update({ where: { id }, data: updates });
  }

  // ============================================
  // 13. DELETE COIN PACKAGE
  // ============================================
  static async deleteCoinPackage(id) {
    const existing = await prisma.coinPackage.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Package not found');

    return prisma.coinPackage.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================
  // 14. PURCHASE COINS
  // ============================================
  static async purchaseCoins(userId, packageId, paymentInfo = {}) {
    const pkg = await this.getCoinPackageById(packageId);

    if (!pkg.isActive) throw AppError.badRequest('Package is not active');

    const totalCoins = pkg.coins + (pkg.bonusCoins || 0);

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, coins: 0 },
        });
      }

      const updated = await tx.wallet.update({
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
          description: `Purchased ${pkg.name} (${totalCoins} coins)`,
          status: 'COMPLETED',
          balanceAfter: updated.balance,
          coinsAfter: updated.coins,
          referenceId: paymentInfo.paymentId || null,
          referenceModel: 'CoinPackage',
          gatewayResponse: paymentInfo || null,
        },
      });

      return updated;
    });

    logInfo(`User ${userId} purchased ${totalCoins} coins`);

    NotificationService.sendCoinNotification(
      userId,
      totalCoins,
      'CREDIT',
      `Purchased ${totalCoins} coins (${pkg.name})`
    ).catch(() => {});

    return { wallet: result, coinsAdded: totalCoins, amountPaid: pkg.price };
  }

  // ============================================
  // 15. ADMIN: Add coins
  // ============================================
  static async adminAddCoins(userId, coins, reason = 'Admin added') {
    if (!userId || !coins || coins <= 0) {
      throw AppError.badRequest('userId and valid coins required');
    }

    return this.addCoins(userId, coins, 'ADMIN_ADD', reason, {
      adminAction: true,
    });
  }

  // ============================================
  // 16. WITHDRAWAL SETTINGS
  // ============================================
  static async getWithdrawalSettings() {
    try {
      const [minSetting, feeSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'COIN_WITHDRAW_LIMIT' } }),
        prisma.setting.findUnique({
          where: { key: 'WITHDRAWAL_FEE_PERCENT' },
        }),
      ]);

      return {
        minAmount: Number(minSetting?.value) || 100,
        feePercent: Number(feeSetting?.value) || 2,
      };
    } catch {
      return { minAmount: 100, feePercent: 2 };
    }
  }

  // ============================================
  // 17. WITHDRAWAL REQUEST
  // ============================================
  static async requestWithdrawal(
    userId,
    {
      amount,
      method,
      accountName,
      accountNumber,
      ifscCode,
      upiId,
      bankName,
    }
  ) {
    if (amount <= 0) throw AppError.badRequest('Amount must be positive');

    const { minAmount, feePercent } = await this.getWithdrawalSettings();

    if (amount < minAmount) {
      throw AppError.badRequest(`Minimum withdrawal amount is ${minAmount}`);
    }

    const wallet = await this.getWallet(userId);
    if (wallet.balance < amount) {
      throw AppError.badRequest('Insufficient balance');
    }

    const fee = helpers.round((amount * feePercent) / 100, 2);
    const netAmount = amount - fee;

    const result = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          pendingBalance: { increment: amount },
        },
      });

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          amount,
          fee,
          netAmount,
          method,
          accountName: accountName || null,
          accountNumber: accountNumber || null,
          ifscCode: ifscCode || null,
          upiId: upiId || null,
          bankName: bankName || null,
          status: 'PENDING',
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEBIT',
          category: 'WITHDRAWAL',
          amount,
          coins: 0,
          description: `Withdrawal request (${method})`,
          status: 'PENDING',
          referenceId: withdrawal.id,
          referenceModel: 'Withdrawal',
        },
      });

      return withdrawal;
    });

    logInfo(`Withdrawal requested: ${amount} by ${userId}`);
    return result;
  }

  // ============================================
  // 18. GET MY WITHDRAWALS
  // ============================================
  static async getWithdrawals(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawal.count({ where: { userId } }),
    ]);

    return {
      data: withdrawals,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 19. ADMIN: Get all withdrawals
  // ============================================
  static async getAllWithdrawals({ page = 1, limit = 20, status } = {}) {
    const where = {};
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawal.count({ where }),
    ]);

    return {
      data: withdrawals,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 20. ADMIN: Process withdrawal
  // ============================================
  static async processWithdrawal(
    withdrawalId,
    status,
    adminId,
    failureReason = null
  ) {
    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      throw AppError.badRequest('Invalid status');
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });
    if (!withdrawal) throw AppError.notFound('Withdrawal not found');

    if (
      withdrawal.status === 'COMPLETED' ||
      withdrawal.status === 'REJECTED'
    ) {
      throw AppError.badRequest('Withdrawal already processed');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status,
          processedBy: adminId,
          processedAt: new Date(),
          failureReason,
        },
      });

      if (status === 'COMPLETED') {
        await tx.wallet.update({
          where: { userId: withdrawal.userId },
          data: {
            pendingBalance: { decrement: withdrawal.amount },
            totalWithdrawn: { increment: withdrawal.amount },
          },
        });

        await tx.transaction.updateMany({
          where: { referenceId: withdrawal.id, referenceModel: 'Withdrawal' },
          data: { status: 'COMPLETED' },
        });
      } else if (status === 'REJECTED') {
        await tx.wallet.update({
          where: { userId: withdrawal.userId },
          data: {
            pendingBalance: { decrement: withdrawal.amount },
            balance: { increment: withdrawal.amount },
          },
        });

        await tx.transaction.updateMany({
          where: { referenceId: withdrawal.id, referenceModel: 'Withdrawal' },
          data: { status: 'FAILED', failureReason },
        });
      }

      return updated;
    });

    try {
      await NotificationService.sendWithdrawalNotification(
        withdrawal.userId,
        withdrawal.amount,
        status,
        failureReason
      );

      if (withdrawal.user?.email) {
        EmailService.sendWithdrawalUpdate(withdrawal.user, result).catch(
          () => {}
        );
      }
    } catch (e) {
      logError('Withdrawal notify failed', e);
    }

    logInfo(`Withdrawal ${withdrawalId} → ${status}`);
    return result;
  }

  // ============================================
  // 21. ADMIN: Withdrawal stats
  // ============================================
  static async getWithdrawalStats() {
    const [pending, approved, rejected, completed, totalAmount] =
      await Promise.all([
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.withdrawal.count({ where: { status: 'APPROVED' } }),
        prisma.withdrawal.count({ where: { status: 'REJECTED' } }),
        prisma.withdrawal.count({ where: { status: 'COMPLETED' } }),
        prisma.withdrawal.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amount: true, fee: true, netAmount: true },
        }),
      ]);

    return {
      pending,
      approved,
      rejected,
      completed,
      totalPaidOut: totalAmount._sum.netAmount || 0,
      totalFees: totalAmount._sum.fee || 0,
    };
  }
}

module.exports = WalletService;