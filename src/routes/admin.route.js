// ============================================
// Admin Routes — Bond (Complete)
// Note: authenticate + requireAdmin + auditAdminAction
// are already applied in app.js
// ============================================

const express = require('express');
const AdminController = require('../controllers/admin.controller');
const { validate } = require('../middleware/validate');
const AdminValidator = require('../validators/admin.validator');

const router = express.Router();

// ============================================
// DASHBOARD
// ============================================
router.get('/dashboard/stats', AdminController.getDashboardStats);
router.get('/dashboard/growth', AdminController.getUserGrowth);
router.get('/dashboard/activities', AdminController.getRecentActivities);
router.get('/dashboard/revenue', AdminController.getRevenueStats);
router.get('/dashboard/top-girls', AdminController.getTopGirls);
router.get('/dashboard/top-users', AdminController.getTopUsers);

// ⭐ Charts (NEW)
router.get('/dashboard/revenue-chart', AdminController.getRevenueChart);
router.get('/dashboard/calls-chart', AdminController.getCallsChart);

// ============================================
// USERS
// ============================================
router.get(
  '/users',
  validate(AdminValidator.getUsers),
  AdminController.getUsers
);
router.get('/users/:id', AdminController.getUserDetail);
router.get('/users/:id/activity', AdminController.getUserActivity); // ⭐ NEW

router.put(
  '/users/:id/status',
  validate(AdminValidator.updateUserStatus),
  AdminController.updateUserStatus
);
router.put(
  '/users/:id/block',
  validate(AdminValidator.blockUser),
  AdminController.blockUser
);
router.put('/users/:id/unblock', AdminController.unblockUser);
router.delete('/users/:id', AdminController.deleteUser);

// ============================================
// GIRLS
// ============================================
router.get(
  '/girls',
  validate(AdminValidator.getGirls),
  AdminController.getGirls
);
router.put(
  '/girls/:id/verify',
  validate(AdminValidator.verifyGirl),
  AdminController.verifyGirl
);
router.put(
  '/girls/:id',
  validate(AdminValidator.updateGirl),
  AdminController.updateGirl
);
router.delete('/girls/:id', AdminController.deleteGirl);

// ⭐ Auto-payout (manual trigger)
router.post('/girls/auto-payout', AdminController.runGirlAutoPayout);

// ============================================
// ⭐ RATE MANAGEMENT
// ============================================
router.get('/rates/pending', AdminController.getPendingRateChanges);
router.put(
  '/rates/pending/:id',
  validate(AdminValidator.processRateChange),
  AdminController.processRateChange
);
router.get('/rates/global', AdminController.getGlobalRates);
router.put(
  '/rates/global',
  validate(AdminValidator.updateGlobalRates),
  AdminController.updateGlobalRates
);

// ============================================
// ⭐ PAYOUT RATES (NEW)
// ============================================
router.get('/payout/rates', AdminController.getPayoutRates);
router.put(
  '/payout/rates',
  validate(AdminValidator.updatePayoutRates),
  AdminController.updatePayoutRates
);

// ============================================
// WALLET
// ============================================
router.get('/wallet/stats', AdminController.getWalletStats);
router.get(
  '/wallet/transactions',
  validate(AdminValidator.getTransactions),
  AdminController.getTransactions
);
router.get(
  '/wallet/withdrawals',
  validate(AdminValidator.getWithdrawals),
  AdminController.getWithdrawals
);

// ⭐ Refund (NEW)
router.post(
  '/wallet/refund',
  validate(AdminValidator.processRefund),
  AdminController.processRefund
);

// ============================================
// SETTINGS
// ============================================
router.get('/settings', AdminController.getSettings);
router.post(
  '/settings',
  validate(AdminValidator.createSetting),
  AdminController.createSetting
);
router.get('/settings/:key', AdminController.getSetting);
router.put(
  '/settings/:key',
  validate(AdminValidator.updateSetting),
  AdminController.updateSetting
);
router.delete('/settings/:key', AdminController.deleteSetting);

// ============================================
// ADMINS
// ============================================
router.get('/admins', AdminController.getAllAdmins);
router.put(
  '/admins/:id',
  validate(AdminValidator.updateAdmin),
  AdminController.updateAdmin
);
router.delete('/admins/:id', AdminController.removeAdmin);
router.get('/admins/:id/login-history', AdminController.getAdminLoginHistory);
// ============================================
// ⭐ ANALYTICS (NEW)
// ============================================
router.get('/analytics/gifts', AdminController.getGiftAnalytics);
router.get('/analytics/subscriptions', AdminController.getSubscriptionAnalytics);
router.get('/analytics/reports', AdminController.getReportAnalytics);
router.get('/analytics/support', AdminController.getSupportAnalytics);

// ============================================
// ⭐ BULK ACTIONS (NEW)
// ============================================
router.post('/users/bulk/block', AdminController.bulkBlockUsers);
router.post('/users/bulk/unblock', AdminController.bulkUnblockUsers);
router.post('/users/bulk/delete', AdminController.bulkDeleteUsers);
// ============================================
// ANALYTICS
// ============================================
router.get('/analytics', AdminController.getAnalytics);
// ============================================
// ⭐ CHARTS + ADMIN ROLES (NEW)
// ============================================
router.get('/dashboard/gender-chart', AdminController.getGenderChart);

// Admin roles hierarchy
router.post('/sub-admins', AdminController.createSubAdmin);
router.get('/sub-admins', AdminController.getSubAdmins);
router.get('/me/permissions', AdminController.getAdminPermissions);
router.put('/sub-admins/:id/permissions', AdminController.updateSubAdminPermissions);

module.exports = router;