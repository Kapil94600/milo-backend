// ============================================
// Admin Routes
// ============================================

const express = require('express');
const AdminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const AdminValidator = require('../validators/admin.validator');

const router = express.Router();

// All admin routes require admin auth
router.use(authenticate, requireAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get('/dashboard/stats', AdminController.getDashboardStats);
router.get('/dashboard/growth', AdminController.getUserGrowth);
router.get('/dashboard/activities', AdminController.getRecentActivities);
router.get('/dashboard/revenue', AdminController.getRevenueStats);
router.get('/dashboard/top-girls', AdminController.getTopGirls);
router.get('/dashboard/top-users', AdminController.getTopUsers);

// ============================================
// USERS
// ============================================
router.get('/users', validate(AdminValidator.getUsers), AdminController.getUsers);
router.get('/users/:id', AdminController.getUserDetail);
router.put('/users/:id/status', validate(AdminValidator.updateUserStatus), AdminController.updateUserStatus);
router.put('/users/:id/block', validate(AdminValidator.blockUser), AdminController.blockUser);
router.put('/users/:id/unblock', AdminController.unblockUser);
router.delete('/users/:id', AdminController.deleteUser);

// ============================================
// GIRLS
// ============================================
router.get('/girls', validate(AdminValidator.getGirls), AdminController.getGirls);
router.put('/girls/:id/verify', validate(AdminValidator.verifyGirl), AdminController.verifyGirl);
router.put('/girls/:id', validate(AdminValidator.updateGirl), AdminController.updateGirl);
router.delete('/girls/:id', AdminController.deleteGirl);

// ============================================
// WALLET
// ============================================
router.get('/wallet/stats', AdminController.getWalletStats);
router.get('/wallet/transactions', validate(AdminValidator.getTransactions), AdminController.getTransactions);
router.get('/wallet/withdrawals', validate(AdminValidator.getWithdrawals), AdminController.getWithdrawals);

// ============================================
// SETTINGS
// ============================================
router.get('/settings', AdminController.getSettings);
router.post('/settings', validate(AdminValidator.createSetting), AdminController.createSetting);
router.get('/settings/:key', AdminController.getSetting);
router.put('/settings/:key', validate(AdminValidator.updateSetting), AdminController.updateSetting);
router.delete('/settings/:key', AdminController.deleteSetting);

// ============================================
// ADMINS
// ============================================
router.get('/admins', AdminController.getAllAdmins);
router.put('/admins/:id', validate(AdminValidator.updateAdmin), AdminController.updateAdmin);
router.delete('/admins/:id', AdminController.removeAdmin);
router.get('/admins/:id/login-history', AdminController.getAdminLoginHistory);

// ============================================
// ANALYTICS
// ============================================
router.get('/analytics', AdminController.getAnalytics);

module.exports = router;