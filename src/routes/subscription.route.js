// ============================================
// Subscription Routes
// ============================================

const express = require('express');
const SubscriptionController = require('../controllers/subscription.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const SubscriptionValidator = require('../validators/subscription.validator');
const idempotency = require('../middleware/idempotency');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Folder setter
const setPlanFolder = (req, res, next) => {
  req.uploadFolder = 'subscription-plans';
  next();
};

// ============================================
// PUBLIC
// ============================================
router.get('/plans', SubscriptionController.getPlans);
router.get('/plans/:id', SubscriptionController.getPlanById);

// ============================================
// USER
// ============================================
router.use(authenticate);

router.post(
  '/subscribe',
  idempotency,
  validate(SubscriptionValidator.subscribe),
  SubscriptionController.subscribe
);

router.get('/my-subscription', SubscriptionController.getMySubscription);

router.get(
  '/my-subscriptions',
  validate(SubscriptionValidator.paginationQuery),
  SubscriptionController.getMySubscriptions
);

router.post('/cancel', SubscriptionController.cancelSubscription);
router.get('/check', SubscriptionController.checkActive);

// ============================================
// ADMIN — Create Plan (with file upload)
// ============================================
router.post(
  '/plans',
  requireAdmin,
  setPlanFolder,
  uploadImage.single('imageFile'),
  handleMulterError,
  validate(SubscriptionValidator.createPlan),
  SubscriptionController.createPlan
);

// ============================================
// ADMIN — Update Plan (with file upload)
// ============================================
router.put(
  '/plans/:id',
  requireAdmin,
  setPlanFolder,
  uploadImage.single('imageFile'),
  handleMulterError,
  validate(SubscriptionValidator.updatePlan),
  SubscriptionController.updatePlan
);

router.delete('/plans/:id', requireAdmin, SubscriptionController.deletePlan);
router.get('/admin/stats', requireAdmin, SubscriptionController.getStats);
router.get('/admin/plans/:id/subscriptions', requireAdmin, SubscriptionController.getPlanSubscriptions);
router.post('/admin/renew', requireAdmin, SubscriptionController.renewSubscriptions);

module.exports = router;