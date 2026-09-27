// ============================================
// Wallet Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const WalletService = require('../services/wallet.service');
const ApiResponse = require('../utils/response');

// ============================================
// USER
// ============================================

// GET /wallet
const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await WalletService.getWallet(req.user.id);
  return ApiResponse.success(res, wallet, 'Wallet fetched');
});

// GET /wallet/transactions
const getMyTransactions = asyncHandler(async (req, res) => {
  const { page, limit, type, category } = req.query;
  const result = await WalletService.getTransactions(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    type: type || undefined,
    category: category || undefined,
  });
  return ApiResponse.success(res, result, 'Transactions fetched');
});

// GET /wallet/stats
const getMyStats = asyncHandler(async (req, res) => {
  const stats = await WalletService.getTransactionStats(req.user.id);
  return ApiResponse.success(res, stats, 'Wallet stats fetched');
});

// POST /wallet/purchase-coins
const purchaseCoins = asyncHandler(async (req, res) => {
  const { packageId, paymentInfo } = req.body;
  const result = await WalletService.purchaseCoins(req.user.id, packageId, paymentInfo || {});
  return ApiResponse.success(res, result, 'Coins purchased successfully');
});

// POST /wallet/withdraw
const requestWithdrawal = asyncHandler(async (req, res) => {
  const withdrawal = await WalletService.requestWithdrawal(req.user.id, req.body);
  return ApiResponse.created(res, withdrawal, 'Withdrawal request submitted');
});

// GET /wallet/withdrawals
const getMyWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await WalletService.getWithdrawals(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Withdrawals fetched');
});

// ============================================
// COIN PACKAGES (public read)
// ============================================

// GET /wallet/coin-packages
const getCoinPackages = asyncHandler(async (req, res) => {
  const packages = await WalletService.getCoinPackages(true);
  return ApiResponse.success(res, packages, 'Coin packages fetched');
});

// ============================================
// ADMIN — Coin Packages (with file upload)
// ============================================

// POST /wallet/coin-packages — supports file upload
const createCoinPackage = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded file (if multipart)
  if (req.file) {
    data._uploadedFile = req.file;
  }

  const pkg = await WalletService.createCoinPackage(data);
  return ApiResponse.created(res, pkg, 'Coin package created');
});

// PUT /wallet/coin-packages/:id — supports file upload
const updateCoinPackage = asyncHandler(async (req, res) => {
  console.log('📥 [Update CoinPackage] req.body:', req.body);
  console.log('📁 [Update CoinPackage] req.file:', req.file);
  console.log('📁 [Update CoinPackage] req.files:', req.files);

  const data = { ...req.body };

  if (req.file) {
    data._uploadedFile = req.file;
  }

  const pkg = await WalletService.updateCoinPackage(req.params.id, data);
  return ApiResponse.success(res, pkg, 'Coin package updated');
});

// DELETE /wallet/coin-packages/:id
const deleteCoinPackage = asyncHandler(async (req, res) => {
  const pkg = await WalletService.deleteCoinPackage(req.params.id);
  return ApiResponse.success(res, pkg, 'Coin package deleted');
});

// POST /wallet/admin/add-coins
const adminAddCoins = asyncHandler(async (req, res) => {
  const { userId, coins, reason } = req.body;
  const wallet = await WalletService.adminAddCoins(userId, coins, reason);
  return ApiResponse.success(res, wallet, 'Coins added successfully');
});

// GET /wallet/admin/withdrawals
const getWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await WalletService.getAllWithdrawals({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
  });
  return ApiResponse.success(res, result, 'Withdrawals fetched');
});

// PUT /wallet/admin/withdrawals/:id
const processWithdrawal = asyncHandler(async (req, res) => {
  const { status, failureReason } = req.body;
  const withdrawal = await WalletService.processWithdrawal(
    req.params.id,
    status,
    req.user.id,
    failureReason
  );
  return ApiResponse.success(res, withdrawal, `Withdrawal ${status.toLowerCase()}`);
});

// GET /wallet/admin/withdrawal-stats
const getWithdrawalStats = asyncHandler(async (req, res) => {
  const stats = await WalletService.getWithdrawalStats();
  return ApiResponse.success(res, stats, 'Withdrawal stats fetched');
});

// ============================================
// Exports
// ============================================
module.exports = {
  // User
  getMyWallet,
  getMyTransactions,
  getMyStats,
  purchaseCoins,
  requestWithdrawal,
  getMyWithdrawals,
  getCoinPackages,

  // Admin
  createCoinPackage,
  updateCoinPackage,
  deleteCoinPackage,
  adminAddCoins,
  getWithdrawals,
  processWithdrawal,
  getWithdrawalStats,
};