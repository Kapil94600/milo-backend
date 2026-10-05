// ============================================
// Admin Controller — Bond (Complete)
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const AdminService = require('../services/admin.service');
const ApiResponse = require('../utils/response');

// ============================================
// DASHBOARD
// ============================================
const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await AdminService.getDashboardStats();
  return ApiResponse.success(res, stats, 'Dashboard stats');
});

const getUserGrowth = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const growth = await AdminService.getUserGrowth(parseInt(days) || 30);
  return ApiResponse.success(res, growth, 'User growth data');
});

const getRecentActivities = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;
  const activities = await AdminService.getRecentActivities(parseInt(limit) || 20);
  return ApiResponse.success(res, activities, 'Recent activities');
});

const getRevenueStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const revenue = await AdminService.getRevenueStats(parseInt(days) || 30);
  return ApiResponse.success(res, revenue, 'Revenue stats');
});

const getTopGirls = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const girls = await AdminService.getTopGirls(parseInt(limit) || 10);
  return ApiResponse.success(res, girls, 'Top girls');
});

const getTopUsers = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const users = await AdminService.getTopUsers(parseInt(limit) || 10);
  return ApiResponse.success(res, users, 'Top users');
});

// ============================================
// ⭐ CHARTS (NEW)
// ============================================
const getRevenueChart = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await AdminService.getRevenueChart(parseInt(days) || 30);
  return ApiResponse.success(res, data, 'Revenue chart data');
});

const getCallsChart = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await AdminService.getCallsChart(parseInt(days) || 30);
  return ApiResponse.success(res, data, 'Calls chart data');
});

// ============================================
// USERS
// ============================================
const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, status } = req.query;
  const result = await AdminService.getUsers({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search,
    role,
    status,
  });
  return ApiResponse.success(res, result, 'Users fetched');
});

const getUserDetail = asyncHandler(async (req, res) => {
  const user = await AdminService.getUserDetail(req.params.id);
  return ApiResponse.success(res, user, 'User detail');
});

// ⭐ User Activity Timeline (NEW)
const getUserActivity = asyncHandler(async (req, res) => {
  const data = await AdminService.getUserActivity(req.params.id);
  return ApiResponse.success(res, data, 'User activity fetched');
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await AdminService.updateUserStatus(req.params.id, req.body);
  return ApiResponse.success(res, user, 'Status updated');
});

const blockUser = asyncHandler(async (req, res) => {
  const user = await AdminService.blockUser(req.params.id, req.body.reason);
  return ApiResponse.success(res, user, 'User blocked');
});

const unblockUser = asyncHandler(async (req, res) => {
  const user = await AdminService.unblockUser(req.params.id);
  return ApiResponse.success(res, user, 'User unblocked');
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await AdminService.deleteUser(req.params.id);
  return ApiResponse.success(res, result, 'User deleted');
});

// ============================================
// GIRLS
// ============================================
const getGirls = asyncHandler(async (req, res) => {
  const { page, limit, search, isVerified, status } = req.query;
  const result = await AdminService.getGirls({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search,
    isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
    status,
  });
  return ApiResponse.success(res, result, 'Girls fetched');
});

const verifyGirl = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const girl = await AdminService.verifyGirl(req.params.id, status, req.user.id);
  return ApiResponse.success(res, girl, `Girl ${status.toLowerCase()}`);
});

const updateGirl = asyncHandler(async (req, res) => {
  const girl = await AdminService.updateGirl(req.params.id, req.body);
  return ApiResponse.success(res, girl, 'Girl updated');
});

const deleteGirl = asyncHandler(async (req, res) => {
  const result = await AdminService.deleteGirl(req.params.id);
  return ApiResponse.success(res, result, 'Girl deleted');
});

// ⭐ Run Girl Auto-Payout (NEW)
const runGirlAutoPayout = asyncHandler(async (req, res) => {
  const GirlService = require('../services/girl.service');
  const result = await GirlService.runAutoPayout();
  return ApiResponse.success(res, result, 'Auto-payout completed');
});

// ============================================
// ⭐ RATE MANAGEMENT
// ============================================
const getPendingRateChanges = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await AdminService.getPendingRateChanges({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Pending rate changes fetched');
});

const processRateChange = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return ApiResponse.badRequest(res, 'Action must be APPROVED or REJECTED');
  }

  const girl = await AdminService.processRateChange(
    req.params.id,
    action,
    req.user.id
  );
  return ApiResponse.success(res, girl, `Rate change ${action.toLowerCase()}`);
});

const updateGlobalRates = asyncHandler(async (req, res) => {
  const rates = await AdminService.updateGlobalRates(req.body);
  return ApiResponse.success(res, rates, 'Global rates updated');
});

const getGlobalRates = asyncHandler(async (req, res) => {
  const rates = await AdminService.getGlobalRates();
  return ApiResponse.success(res, rates, 'Global rates fetched');
});

// ============================================
// ⭐ PAYOUT RATES (NEW)
// ============================================
const getPayoutRates = asyncHandler(async (req, res) => {
  const rates = await AdminService.getPayoutRates();
  return ApiResponse.success(res, rates, 'Payout rates fetched');
});

const updatePayoutRates = asyncHandler(async (req, res) => {
  const rates = await AdminService.updatePayoutRates(req.body);
  return ApiResponse.success(res, rates, 'Payout rates updated');
});

// ============================================
// WALLET
// ============================================
const getWalletStats = asyncHandler(async (req, res) => {
  const stats = await AdminService.getWalletStats();
  return ApiResponse.success(res, stats, 'Wallet stats');
});

const getTransactions = asyncHandler(async (req, res) => {
  const { page, limit, type, category, userId } = req.query;
  const result = await AdminService.getTransactions({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    type,
    category,
    userId,
  });
  return ApiResponse.success(res, result, 'Transactions fetched');
});

const getWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await AdminService.getWithdrawals({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
  });
  return ApiResponse.success(res, result, 'Withdrawals fetched');
});

// ⭐ Process Refund (NEW)
const processRefund = asyncHandler(async (req, res) => {
  const { transactionId, reason } = req.body;

  const WalletService = require('../services/wallet.service');
  const result = await WalletService.processRefund(
    transactionId,
    req.user.id,
    reason
  );

  return ApiResponse.success(res, result, 'Refund processed');
});

// ============================================
// SETTINGS
// ============================================
const getSettings = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const settings = await AdminService.getSettings(category);
  return ApiResponse.success(res, settings, 'Settings fetched');
});

const getSetting = asyncHandler(async (req, res) => {
  const setting = await AdminService.getSetting(req.params.key);
  return ApiResponse.success(res, setting, 'Setting fetched');
});

const updateSetting = asyncHandler(async (req, res) => {
  const { value } = req.body;
  const setting = await AdminService.updateSetting(
    req.params.key,
    value,
    req.user.id
  );
  return ApiResponse.success(res, setting, 'Setting updated');
});

const createSetting = asyncHandler(async (req, res) => {
  const setting = await AdminService.createSetting(req.body, req.user.id);
  return ApiResponse.created(res, setting, 'Setting created');
});

const deleteSetting = asyncHandler(async (req, res) => {
  const setting = await AdminService.deleteSetting(req.params.key);
  return ApiResponse.success(res, setting, 'Setting deleted');
});

// ============================================
// ADMINS
// ============================================
const getAllAdmins = asyncHandler(async (req, res) => {
  const admins = await AdminService.getAllAdmins();
  return ApiResponse.success(res, admins, 'Admins fetched');
});

const updateAdmin = asyncHandler(async (req, res) => {
  const admin = await AdminService.updateAdmin(req.params.id, req.body);
  return ApiResponse.success(res, admin, 'Admin updated');
});

const removeAdmin = asyncHandler(async (req, res) => {
  const result = await AdminService.removeAdmin(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Admin removed');
});

const getAdminLoginHistory = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await AdminService.getAdminLoginHistory(req.params.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Login history');
});

// ============================================
// ANALYTICS
// ============================================
const getAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const analytics = await AdminService.getAnalytics(startDate, endDate);
  return ApiResponse.success(res, analytics, 'Analytics fetched');
});
// ============================================
// ⭐ ANALYTICS (NEW)
// ============================================
const getGiftAnalytics = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await AdminService.getGiftAnalytics({ days: parseInt(days) || 30 });
  return ApiResponse.success(res, data, 'Gift analytics fetched');
});

const getSubscriptionAnalytics = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await AdminService.getSubscriptionAnalytics({ days: parseInt(days) || 30 });
  return ApiResponse.success(res, data, 'Subscription analytics fetched');
});

const getReportAnalytics = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await AdminService.getReportAnalytics({ days: parseInt(days) || 30 });
  return ApiResponse.success(res, data, 'Report analytics fetched');
});

const getSupportAnalytics = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const data = await AdminService.getSupportAnalytics({ days: parseInt(days) || 30 });
  return ApiResponse.success(res, data, 'Support analytics fetched');
});

// ============================================
// ⭐ BULK ACTIONS (NEW)
// ============================================
const bulkBlockUsers = asyncHandler(async (req, res) => {
  const { userIds, reason } = req.body;
  const result = await AdminService.bulkBlockUsers(userIds, reason);
  return ApiResponse.success(res, result, `${result.count} users blocked`);
});

const bulkUnblockUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  const result = await AdminService.bulkUnblockUsers(userIds);
  return ApiResponse.success(res, result, `${result.count} users unblocked`);
});

const bulkDeleteUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  const result = await AdminService.bulkDeleteUsers(userIds);
  return ApiResponse.success(res, result, `${result.count} users deleted`);
});
// ============================================
// ⭐ GENDER CHART + ADMIN ROLES (NEW)
// ============================================
const getGenderChart = asyncHandler(async (req, res) => {
  const data = await AdminService.getGenderChart();
  return ApiResponse.success(res, data, 'Gender chart data');
});

const createSubAdmin = asyncHandler(async (req, res) => {
  const data = await AdminService.createSubAdmin(req.user.id, req.body);
  return ApiResponse.created(res, data, 'Sub-admin created');
});

const getAdminPermissions = asyncHandler(async (req, res) => {
  const data = await AdminService.getAdminPermissions(req.user.id);
  return ApiResponse.success(res, data, 'Admin permissions fetched');
});

const updateSubAdminPermissions = asyncHandler(async (req, res) => {
  const data = await AdminService.updateSubAdminPermissions(
    req.user.id,
    req.params.id,
    req.body
  );
  return ApiResponse.success(res, data, 'Permissions updated');
});

const getSubAdmins = asyncHandler(async (req, res) => {
  const data = await AdminService.getSubAdmins();
  return ApiResponse.success(res, data, 'Sub-admins fetched');
});
// ============================================
// Exports
// ============================================
module.exports = {
  // Dashboard
  getDashboardStats,
  getUserGrowth,
  getRecentActivities,
  getRevenueStats,
  getTopGirls,
  getTopUsers,

  // ⭐ Charts
  getRevenueChart,
  getCallsChart,

  // Users
  getUsers,
  getUserDetail,
  getUserActivity, // ⭐ NEW
  updateUserStatus,
  blockUser,
  unblockUser,
  deleteUser,

  // Girls
  getGirls,
  verifyGirl,
  updateGirl,
  deleteGirl,
  runGirlAutoPayout, // ⭐ NEW

  // Rate Management
  getPendingRateChanges,
  processRateChange,
  updateGlobalRates,
  getGlobalRates,

  // ⭐ Payout Rates
  getPayoutRates,
  updatePayoutRates,

  // Wallet
  getWalletStats,
  getTransactions,
  getWithdrawals,
  processRefund, // ⭐ NEW

  // Settings
  getSettings,
  getSetting,
  updateSetting,
  createSetting,
  deleteSetting,

  // Admins
  getAllAdmins,
  updateAdmin,
  removeAdmin,
  getAdminLoginHistory,

  // Analytics
  getAnalytics,
   getGiftAnalytics,
  getSubscriptionAnalytics,
  getReportAnalytics,
  getSupportAnalytics,

  // ⭐ Bulk actions
  bulkBlockUsers,
  bulkUnblockUsers,
  bulkDeleteUsers,
    getGenderChart,
  createSubAdmin,
  getAdminPermissions,
  updateSubAdminPermissions,
  getSubAdmins,
};