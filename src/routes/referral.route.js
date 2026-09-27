// ============================================
// Referral Routes
// ============================================

const express = require('express');
const ReferralController = require('../controllers/referral.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ReferralValidator = require('../validators/referral.validator');

const router = express.Router();

// ============================================
// USER routes
// ============================================
router.use(authenticate);

router.get('/my-code', ReferralController.getMyCode);
router.get('/validate/:code', ReferralController.validateCode);
router.get(
  '/my-referrals',
  validate(ReferralValidator.paginationQuery),
  ReferralController.getMyReferrals
);
router.get('/my-stats', ReferralController.getMyStats);

// ============================================
// ADMIN routes
// ============================================

router.get('/admin/all', requireAdmin, ReferralController.getAllReferrals);
router.put('/admin/:id/complete', requireAdmin, ReferralController.completeReferral);
router.put(
  '/admin/:id/reward',
  requireAdmin,
  validate(ReferralValidator.rewardReferral),
  ReferralController.rewardReferral
);
router.post('/admin/process-pending', requireAdmin, ReferralController.processPendingRewards);

// ============================================
// ✅ CORRECT EXPORT
// ============================================
module.exports = router;