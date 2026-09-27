// ============================================
// Wallet Routes
// ============================================

const express = require('express');
const WalletController = require('../controllers/wallet.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const WalletValidator = require('../validators/wallet.validator');
const idempotency = require('../middleware/idempotency');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Folder setter
const setCoinPackageFolder = (req, res, next) => {
  req.uploadFolder = 'coin-packages';
  next();
};

// ============================================
// All routes require authentication
// ============================================
router.use(authenticate);

// ============================================
// SPECIFIC routes FIRST
// ============================================

// Coin packages (public to authenticated users)
router.get('/coin-packages', WalletController.getCoinPackages);

// Stats
router.get('/stats', WalletController.getMyStats);

// Transactions
router.get(
  '/transactions',
  validate(WalletValidator.getTransactions),
  WalletController.getMyTransactions
);

// Withdrawals (user's own)
router.get('/withdrawals', WalletController.getMyWithdrawals);
router.post(
  '/withdraw',
  idempotency,
  validate(WalletValidator.requestWithdrawal),
  WalletController.requestWithdrawal
);

// Purchase coins
router.post(
  '/purchase-coins',
  idempotency,
  validate(WalletValidator.purchaseCoins),
  WalletController.purchaseCoins
);

// ============================================
// ADMIN routes — Coin Packages (with file upload)
// ============================================

// Create coin package — supports file upload
router.post(
  '/coin-packages',
  requireAdmin,
  setCoinPackageFolder,
  uploadImage.single('imageFile'),
  handleMulterError,
  validate(WalletValidator.createCoinPackage),
  WalletController.createCoinPackage
);

// Update coin package — supports file upload
router.put(
  '/coin-packages/:id',
  requireAdmin,
  setCoinPackageFolder,
  uploadImage.single('imageFile'),
  handleMulterError,
  validate(WalletValidator.updateCoinPackage),
  WalletController.updateCoinPackage
);

// Delete coin package
router.delete('/coin-packages/:id', requireAdmin, WalletController.deleteCoinPackage);

// Admin add coins to user
router.post(
  '/admin/add-coins',
  requireAdmin,
  idempotency,
  validate(WalletValidator.adminAddCoins),
  WalletController.adminAddCoins
);

// Admin: get all withdrawals
router.get('/admin/withdrawals', requireAdmin, WalletController.getWithdrawals);

// Admin: process withdrawal
router.put(
  '/admin/withdrawals/:id',
  requireAdmin,
  validate(WalletValidator.processWithdrawal),
  WalletController.processWithdrawal
);

// Admin: withdrawal stats
router.get('/admin/withdrawal-stats', requireAdmin, WalletController.getWithdrawalStats);

// ============================================
// Dynamic routes LAST
// ============================================

// GET /wallet (must be last)
router.get('/', WalletController.getMyWallet);

module.exports = router;