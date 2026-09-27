// ============================================
// Gift Routes
// ============================================

const express = require('express');
const GiftController = require('../controllers/gift.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const GiftValidator = require('../validators/gift.validator');
const idempotency = require('../middleware/idempotency');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Folder setter
const setGiftFolder = (req, res, next) => {
  req.uploadFolder = 'gifts';
  next();
};

// ============================================
// PUBLIC routes
// ============================================
router.get('/active', GiftController.getActiveGifts);
router.get('/top', GiftController.getTopGifts);
router.get('/category/:category', GiftController.getByCategory);
router.get('/rarity/:rarity', GiftController.getByRarity);

// ============================================
// AUTHENTICATED routes
// ============================================
router.use(authenticate);

// Send gift
router.post(
  '/send',
  idempotency,
  validate(GiftValidator.sendGift),
  GiftController.sendGift
);

// My transactions
router.get(
  '/transactions',
  validate(GiftValidator.getTransactions),
  GiftController.getTransactions
);

// Unread
router.get('/unread', GiftController.getUnread);

// Mark as read
router.put('/transactions/:id/read', GiftController.markAsRead);

// ============================================
// ADMIN routes
// ============================================

// Create gift — supports multiple file fields
router.post(
  '/',
  requireAdmin,
  setGiftFolder,
  uploadImage.fields([
    { name: 'imageFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
    { name: 'animationFile', maxCount: 1 },
    { name: 'soundFile', maxCount: 1 },
  ]),
  handleMulterError,
  validate(GiftValidator.createGift),
  GiftController.createGift
);

router.get('/admin/all', requireAdmin, GiftController.getGifts);
router.get('/admin/stats', requireAdmin, GiftController.getStats);

// Update gift — supports multiple file fields
router.put(
  '/:id',
  requireAdmin,
  setGiftFolder,
  uploadImage.fields([
    { name: 'imageFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
    { name: 'animationFile', maxCount: 1 },
    { name: 'soundFile', maxCount: 1 },
  ]),
  handleMulterError,
  validate(GiftValidator.updateGift),
  GiftController.updateGift
);

router.delete('/:id', requireAdmin, GiftController.deleteGift);

router.put(
  '/:id/toggle',
  requireAdmin,
  validate(GiftValidator.toggleStatus),
  GiftController.toggleGiftStatus
);

// ============================================
// Dynamic LAST
// ============================================
router.get('/:id', GiftController.getGiftById);

module.exports = router;